# app/routes_clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta, datetime
from pathlib import Path
import os
from .database import get_db
from . import models, schemas
from .auth import get_current_user,require_admin, require_owner, require_staff
from .onboarding import create_onboarding_tasks_for_client as create_onboarding_tasks_helper
from .audit import log_event

from .models import (
    Client,
    Task,
    OnboardingTemplateTask,
    User,
)

router = APIRouter(prefix="/clients", tags=["clients"])
# Make docs root configurable for your future NAS move
DOCS_ROOT = Path(os.getenv("YECNY_DOCS_ROOT", "/home/kruzer04/YBTM/YB-TM/docs")).resolve()


def _safe_unlink(path_str: str) -> None:
    """
    Delete a file if it exists, but ONLY if it's inside DOCS_ROOT.
    Prevents accidental deletion outside your docs directory.
    """
    if not path_str:
        return

    p = Path(path_str).resolve()

    # Ensure p is under DOCS_ROOT
    try:
        p.relative_to(DOCS_ROOT)
    except ValueError:
        raise HTTPException(
            status_code=500,
            detail=f"Refusing to delete file outside DOCS_ROOT: {p}",
        )

    try:
        p.unlink()
    except FileNotFoundError:
        # already gone = fine for purge
        return


def _cleanup_empty_parents(start_dir: Path) -> None:
    """
    Try to remove empty directories up to DOCS_ROOT.
    Stops when a directory isn't empty.
    """
    d = start_dir.resolve()
    while True:
        if d == DOCS_ROOT:
            return
        try:
            d.relative_to(DOCS_ROOT)
        except ValueError:
            return

        try:
            d.rmdir()
        except OSError:
            return
        d = d.parent


@router.get("/", response_model=List[schemas.ClientOut])
async def list_clients(
    q: Optional[str] = None,
    tier: Optional[str] = None,
    manager_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Client)

    if q:
        query = query.filter(models.Client.legal_name.ilike(f"%{q}%"))

    if tier:
        query = query.filter(models.Client.tier == tier)

    if manager_id:
        try:
            manager_id_int = int(manager_id)
            query = query.filter(models.Client.manager_id == manager_id_int)
        except ValueError:
            # ignore bad value, treat as no filter
            pass


    return query.order_by(models.Client.legal_name).all()

def create_default_recurring_tasks_for_client(
    db: Session,
    client: models.Client,
    current_user: models.User,
):
    """
    Create the standard recurring rules for a new client:
    - Monthly Bank Feeds
    - Monthly Reconciliations
    - Monthly Questions
    - Monthly Reports

    and generate the first task for each rule.
    """

    # Pick who should own these tasks by default
    if client.bookkeeper_id:
        assigned_id = client.bookkeeper_id
    elif client.manager_id:
        assigned_id = client.manager_id
    else:
        assigned_id = current_user.id

    # Infer schedule type from bookkeeping_frequency, default to monthly
    freq = (client.bookkeeping_frequency or "").lower()
    if freq not in ("monthly", "quarterly", "annual"):
        schedule_type = "monthly"
    else:
        schedule_type = freq

    today = date.today()

    default_rules = [
        "Complete Bank Feeds",
        "Reconcile Accounts",
        "Send Questions to Client",
        "Send Reports to Client",
    ]

    for name in default_rules:
        rt = models.RecurringTask(
            name=name,
            description=f"Default recurring task: {name}",
            schedule_type=schedule_type,   # monthly / quarterly / annual
            day_of_month=25,               # simple pattern: 25th of period
            weekday=None,
            week_of_month=None,
            client_id=client.id,
            assigned_user_id=assigned_id,
            default_status="new",
            next_run=today,
            active=True,
        )
        db.add(rt)
        db.flush()  # get rt.id without committing yet

        # Create the first actual Task instance for this rule
        task = models.Task(
            title=rt.name,
            description=rt.description or "",
            status=rt.default_status,
            due_date=rt.next_run,
            assigned_user_id=rt.assigned_user_id,
            client_id=rt.client_id,
            recurring_task_id=rt.id,
        )
    db.add(task)
    
# One commit for all rules + tasks
    db.commit()

@router.post("/", response_model=schemas.ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    new_client = models.Client(**client_in.dict())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    # 1) Create the default recurring rules + first tasks (unchanged for now)
    create_default_recurring_tasks_for_client(db, new_client, current_user)

    # 2) Create onboarding tasks from templates (Admin/Manager, etc.)
    create_onboarding_tasks_helper(
        db=db,
        client=new_client,
        created_by_user_id=current_user.id,
    )

    return new_client
@router.get("/{client_id}", response_model=schemas.ClientOut)
async def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=schemas.ClientOut)
async def update_client(
    client_id: int,
    client_in: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Work on a mutable dict of just the fields that were actually sent
    data = client_in.dict(exclude_unset=True)

    # Special handling: if primary_contact_id is provided, validate it and
    # (optionally) sync name / email / phone from the Contact record.
    if "primary_contact_id" in data and data["primary_contact_id"] is not None:
        contact_id = data["primary_contact_id"]

        contact = (
            db.query(models.Contact)
            .filter(models.Contact.id == contact_id)
            .first()
        )
        if not contact:
            raise HTTPException(status_code=400, detail="Primary contact not found")

        # Always set the FK
        client.primary_contact_id = contact.id

        # Only overwrite these if the caller did NOT explicitly send them
        if "primary_contact" not in data:
            client.primary_contact = contact.name

        if "email" not in data and contact.email:
            client.email = contact.email

        if "phone" not in data and contact.phone:
            client.phone = contact.phone

        # We've already consumed primary_contact_id
        data.pop("primary_contact_id", None)

    # Apply all remaining fields normally
    for field, value in data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client

@router.get(
    "/{client_id}/onboarding-tasks",
    response_model=List[schemas.TaskOut],
)
async def list_client_onboarding_tasks(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return all onboarding tasks for a single client.
    Used for the Client -> Onboarding tab in the UI.
    """
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.client_id == client_id,
            models.Task.task_type == "onboarding",
        )
        .order_by(models.Task.onboarding_phase.asc(), models.Task.due_date.asc())
        .all()
    )
    return tasks

@router.get(
    "/{client_id}/purge-requests",
    response_model=List[schemas.ClientPurgeRequestOut],
)
def list_client_purge_requests(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List all purge requests for a client (for UI/history).
    """
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    requests = (
        db.query(models.ClientPurgeRequest)
        .filter(models.ClientPurgeRequest.client_id == client_id)
        .order_by(models.ClientPurgeRequest.created_at.desc())
        .all()
    )
    return requests

@router.post("/{client_id}/purge-request", response_model=schemas.ClientPurgeRequestOut)
def create_client_purge_request(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """
    Step 1: Admin starts a purge request for a client.
    (Does NOT delete anything yet.)
    """
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # One pending request per client
    existing = (
        db.query(models.ClientPurgeRequest)
        .filter(
            models.ClientPurgeRequest.client_id == client_id,
            models.ClientPurgeRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="There is already a pending purge request for this client.",
        )

    pr = models.ClientPurgeRequest(
        client_id=client_id,
        requested_by_id=current_user.id,
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr



@router.post("/{client_id}/purge-request/{request_id}/approve")
def approve_and_execute_client_purge(
    client_id: int,
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    pr = (
        db.query(models.ClientPurgeRequest)
        .filter(
            models.ClientPurgeRequest.id == request_id,
            models.ClientPurgeRequest.client_id == client_id,
        )
        .first()
    )
    if not pr or pr.status != "pending":
        raise HTTPException(status_code=404, detail="Pending purge request not found.")

    if pr.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="The owner approving the purge must be a different user than the requester.",
        )

    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # mark approved (audit-ish)
    pr.status = "approved"
    pr.approved_by_id = current_user.id
    pr.approved_at = datetime.utcnow()
    db.flush()

    try:
        # 1) Delete document files from disk (then DB rows)
        docs = db.query(models.Document).filter(models.Document.client_id == client_id).all()
        for doc in docs:
            if doc.stored_path:
                _safe_unlink(doc.stored_path)
                _cleanup_empty_parents(Path(doc.stored_path).resolve().parent)

        db.query(models.Document).filter(models.Document.client_id == client_id).delete(
            synchronize_session=False
        )

        # 2) Tasks: delete children first (subtasks/notes), then tasks
        task_ids = [
            tid for (tid,) in db.query(models.Task.id).filter(models.Task.client_id == client_id).all()
        ]
        if task_ids:
            db.query(models.TaskSubtask).filter(models.TaskSubtask.task_id.in_(task_ids)).delete(
                synchronize_session=False
            )
            db.query(models.TaskNote).filter(models.TaskNote.task_id.in_(task_ids)).delete(
                synchronize_session=False
            )
            db.query(models.Task).filter(models.Task.id.in_(task_ids)).delete(
                synchronize_session=False
            )

        # 3) Other client-linked tables
        db.query(models.Account).filter(models.Account.client_id == client_id).delete(synchronize_session=False)
        db.query(models.RecurringTask).filter(models.RecurringTask.client_id == client_id).delete(synchronize_session=False)
        db.query(models.ClientNote).filter(models.ClientNote.client_id == client_id).delete(synchronize_session=False)

        # 4) Intake rows for this client (true purge = delete, not detach)
        intake_ids = [
            iid for (iid,) in db.query(models.ClientIntake.id).filter(models.ClientIntake.client_id == client_id).all()
        ]
        if intake_ids:
            db.query(models.IntakeOwner).filter(models.IntakeOwner.intake_id.in_(intake_ids)).delete(
                synchronize_session=False
            )
            db.query(models.ClientIntake).filter(models.ClientIntake.id.in_(intake_ids)).delete(
                synchronize_session=False
            )

        # 5) Purge requests must go too (your FK is non-nullable)
        db.query(models.ClientPurgeRequest).filter(models.ClientPurgeRequest.client_id == client_id).delete(
            synchronize_session=False
        )

        # 6) Finally delete the client row
        db.delete(client)
        log_event(
            db,
            actor_user_id=current_user.id,
            action="client.purge.executed",
            entity_type="client",
            entity_id=client_id,
            client_id=client_id,
            meta={"purge_request_id": request_id},
        )
        db.commit()
        return {"message": "Client and related data purged successfully."}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during purge: {str(e)}",
        )