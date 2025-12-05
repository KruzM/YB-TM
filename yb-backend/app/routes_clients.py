# app/routes_clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from .database import get_db
from . import models, schemas
from .auth import get_current_user,require_admin, require_owner

router = APIRouter(prefix="/clients", tags=["clients"])


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

    create_default_recurring_tasks_for_client(db, new_client, current_user)

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
    """
    Step 2: Owner approves the purge request.
    This will delete the client and all linked data.
    """
    pr = (
        db.query(models.ClientPurgeRequest)
        .filter(
            models.ClientPurgeRequest.id == request_id,
            models.ClientPurgeRequest.client_id == client_id,
        )
        .first()
    )
    if not pr or pr.status != "pending":
        raise HTTPException(
            status_code=404,
            detail="Pending purge request not found.",
        )

    # Enforce "two people" rule
    if pr.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="The owner approving the purge must be a different user than the requester.",
        )

    # Perform the purge � delete related records first, then the client
    db.query(models.Task).filter(models.Task.client_id == client_id).delete()
    db.query(models.Account).filter(models.Account.client_id == client_id).delete()
    db.query(models.Document).filter(models.Document.client_id == client_id).delete()

    client = db.query(models.Client).get(client_id)
    if client:
        db.delete(client)

    pr.status = "executed"
    pr.approved_by_id = current_user.id
    pr.approved_at = datetime.utcnow()
    pr.executed_at = datetime.utcnow()

    db.commit()

    return {"message": "Client and related data purged successfully."}