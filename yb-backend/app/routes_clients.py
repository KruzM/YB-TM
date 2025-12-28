# app/routes_clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import date, timedelta, datetime
from pathlib import Path
import os
from .database import get_db
from . import models, schemas
from .auth import get_current_user,require_admin, require_owner, require_staff
from .onboarding import create_onboarding_tasks_for_client as create_onboarding_tasks_helper
from .audit import log_event
from .recurring_utils import advance_next_run
from .permissions import assert_client_access, is_owner, is_admin, is_manager, is_bookkeeper

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

    # Access control (internal staff + portal users):
    # - Owner/Admin see all clients
    # - Manager sees clients where manager_id == user.id
    # - Bookkeeper sees clients where bookkeeper_id == user.id
    # - Portal users see clients via ClientUserAccess
    if not (is_owner(current_user) or is_admin(current_user)):
        query = (
            query.outerjoin(
                models.ClientUserAccess,
                models.ClientUserAccess.client_id == models.Client.id,
            )
            .filter(
                or_(
                    models.Client.manager_id == current_user.id,
                    models.Client.bookkeeper_id == current_user.id,
                    models.ClientUserAccess.user_id == current_user.id,
                )
            )
            .distinct()
        )

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

def create_default_recurring_tasks_for_client(db, client, created_by_user_id: int | None = None):
    templates = (
        db.query(models.RecurringTemplateTask)
        .filter_by(is_active=True)
        .order_by(models.RecurringTemplateTask.order_index.asc())
        .all()
    )

    # Seed defaults if none exist
    if not templates:
        templates = [
            models.RecurringTemplateTask(
                name="Categorize Transactions",
                schedule_type="client_frequency",
                day_of_month=10,
                initial_delay_days=21,
                default_assigned_role="bookkeeper",
                default_status="open",
                order_index=10,
                is_active=True,
            ),
            models.RecurringTemplateTask(
                name="Reconcile Accounts",
                schedule_type="client_frequency",
                day_of_month=15,
                initial_delay_days=21,
                default_assigned_role="bookkeeper",
                default_status="open",
                order_index=20,
                is_active=True,
            ),
            models.RecurringTemplateTask(
                name="Client Questions",
                schedule_type="client_frequency",
                day_of_month=20,
                initial_delay_days=21,
                default_assigned_role="bookkeeper",
                default_status="open",
                order_index=30,
                is_active=True,
            ),
            models.RecurringTemplateTask(
                name="Send Reports",
                schedule_type="client_frequency",
                day_of_month=25,
                initial_delay_days=21,
                default_assigned_role="bookkeeper",
                default_status="open",
                order_index=40,
                is_active=True,
            ),
        ]
        db.add_all(templates)
        db.commit()
    # Resolve schedule type from client bookkeeping frequency
    freq = (client.bookkeeping_frequency or "").lower()
    if "quarter" in freq:
        client_sched = "quarterly"
    elif "annual" in freq or "year" in freq:
        client_sched = "annual"
    else:
        client_sched = "monthly"

    def pick_assignee(default_role: str | None) -> int | None:
        role = (default_role or "").lower().strip()
        if role == "bookkeeper":
            return client.bookkeeper_id or client.manager_id or created_by_user_id
        if role == "manager":
            return client.manager_id or client.bookkeeper_id or created_by_user_id
        if role == "admin":
            return created_by_user_id or client.manager_id or client.bookkeeper_id
        return client.bookkeeper_id or client.manager_id or created_by_user_id

    for tpl in templates:
        name = (tpl.name or "").strip()
        if not name:
            continue

        # Prevent duplicate RULES per client+name
        existing_rule = (
            db.query(models.RecurringTask)
            .filter_by(client_id=client.id, name=name)
            .first()
        )
        if existing_rule:
            continue

        schedule_type = (tpl.schedule_type or "client_frequency").strip()
        if schedule_type == "client_frequency":
            schedule_type = client_sched

        delay_days = tpl.initial_delay_days if tpl.initial_delay_days is not None else 21
        start_from = date.today() + timedelta(days=delay_days)

        first_due = advance_next_run(
            schedule_type=schedule_type,
            day_of_month=tpl.day_of_month or 25,
            weekday=tpl.weekday,
            week_of_month=tpl.week_of_month,
            from_date=start_from,
        )

        assigned_user_id = pick_assignee(getattr(tpl, "default_assigned_role", None))
        default_status = getattr(tpl, "default_status", None) or "open"

        rt = models.RecurringTask(
            name=name,
            description=tpl.description,
            schedule_type=schedule_type,
            day_of_month=tpl.day_of_month,
            weekday=tpl.weekday,
            week_of_month=tpl.week_of_month,
            client_id=client.id,
            assigned_user_id=assigned_user_id,
            default_status=default_status,
            next_run=first_due,  # will advance after creating the initial task
            active=True,
        )
        db.add(rt)
        db.flush()
       # Create the initial concrete task for first_due
        task = models.Task(
            title=name,
            description=tpl.description,
            due_date=first_due,  # keep DATE to match run_recurring.py comparisons
            assigned_user_id=assigned_user_id,
            client_id=client.id,
            recurring_task_id=rt.id,
            task_type="recurring",
            status=default_status,
        )
        db.add(task)

        # Advance rule.next_run to next cycle (matches routes_recurring.py behavior)
        rt.next_run = advance_next_run(
            schedule_type,
            first_due,
            day_of_month=rt.day_of_month,
            weekday=rt.weekday,
            week_of_month=rt.week_of_month,
        )

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
    client = assert_client_access(db, current_user, client_id)
    return client


@router.put("/{client_id}", response_model=schemas.ClientOut)
async def update_client(
    client_id: int,
    client_in: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = assert_client_access(db, current_user, client_id)

    if (current_user.role or '').strip().lower() == 'client':
        raise HTTPException(status_code=403, detail='Clients cannot edit client records')

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
