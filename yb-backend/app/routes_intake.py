# yb-backend/app/routes_intake.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Response
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin
from datetime import datetime, date, timedelta
from .onboarding import create_onboarding_tasks_for_client
from .routes_clients import create_default_recurring_tasks_for_client
import json

router = APIRouter(prefix="/intake", tags=["client-intake"])


@router.post("/", response_model=schemas.ClientIntakeOut, status_code=status.HTTP_201_CREATED)
async def create_intake(
    intake_in: schemas.ClientIntakeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new client intake record.

    This is used when you're on a discovery call / initial meeting with a prospect.
    """

    # Dump everything from the schema
    data = intake_in.model_dump(exclude_unset=True)
    # Normalize custom_recurring_rules to JSON string if it's a list/dict
    if "custom_recurring_rules" in data and data["custom_recurring_rules"] is not None:
        if isinstance(data["custom_recurring_rules"], (list, dict)):
            data["custom_recurring_rules"] = json.dumps(data["custom_recurring_rules"])

    # Pull out owner_contact_ids so we DON'T try to pass it into ClientIntake(...)
    owner_ids = data.pop("owner_contact_ids", None) or []

    # Only pass fields that actually exist on ClientIntake
    intake = models.ClientIntake(
        **data,
        status="new",
        created_by_id=current_user.id if current_user else None,
    )

    db.add(intake)
    db.flush()  # so intake.id is available

    # Create IntakeOwner link rows if provided
    for cid in owner_ids:
        db.add(models.IntakeOwner(intake_id=intake.id, contact_id=int(cid)))

    db.commit()
    db.refresh(intake)
    return intake

def _repair_orphaned_intakes(db: Session) -> int:
    orphaned = (
        db.query(models.ClientIntake)
        .filter(models.ClientIntake.client_id.isnot(None))
        .filter(
            ~db.query(models.Client.id)
            .filter(models.Client.id == models.ClientIntake.client_id)
            .exists()
        )
        .all()
    )

    if not orphaned:
        return 0

    for i in orphaned:
        i.client_id = None
        i.converted_at = None

    db.commit()
    return len(orphaned)


@router.get("/", response_model=List[schemas.ClientIntakeOut])
async def list_intakes(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by status: new, in_progress, completed, archived",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Search by legal name, DBA, or primary contact",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List intake records, with optional status & text search.
    """
    q = db.query(models.ClientIntake)
    _repair_orphaned_intakes(db)
    if status_filter:
        q = q.filter(models.ClientIntake.status == status_filter)

    if search:
        like = f"%{search}%"
        q = q.filter(
            models.ClientIntake.legal_name.ilike(like)
            | models.ClientIntake.dba_name.ilike(like)
            | models.ClientIntake.primary_contact_name.ilike(like)
        )

    q = q.order_by(models.ClientIntake.created_at.desc())
    return q.all()


@router.get("/{intake_id}", response_model=schemas.ClientIntakeOut)
async def get_intake(
    intake_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    intake = db.query(models.ClientIntake).filter(models.ClientIntake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")
    return intake


@router.put("/{intake_id}", response_model=schemas.ClientIntakeOut)
async def update_intake(
    intake_id: int,
    intake_in: schemas.ClientIntakeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Full/partial update for an intake record.
    Use this to change status, tweak answers, etc.
    """
    intake = (
        db.query(models.ClientIntake)
        .filter(models.ClientIntake.id == intake_id)
        .first()
    )
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    # Apply any fields that were sent
    update_data = intake_in.model_dump(exclude_unset=True)

    # Normalize custom_recurring_rules to JSON string if it's a list/dict
    if "custom_recurring_rules" in update_data and update_data["custom_recurring_rules"] is not None:
        if isinstance(update_data["custom_recurring_rules"], (list, dict)):
            update_data["custom_recurring_rules"] = json.dumps(update_data["custom_recurring_rules"])

    for field, value in update_data.items():
        setattr(intake, field, value)

    db.commit()
    db.refresh(intake)
    return intake


@router.delete("/{intake_id}", status_code=204)
def delete_intake(
    intake_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)

    intake = db.query(models.ClientIntake).get(intake_id)
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    # Safety: don't allow deleting an intake that's already converted
    if intake.client_id is not None:
        raise HTTPException(
            status_code=409,
            detail="This intake is already converted to a client. Archive it instead (or add a force-delete workflow).",
        )

    # Clean up join table rows first (SQLite + batch constraints can be picky)
    db.query(models.IntakeOwner).filter(models.IntakeOwner.intake_id == intake_id).delete(
        synchronize_session=False
    )

    db.delete(intake)
    db.commit()
    return Response(status_code=204)


# Helper: safely turn a value into an int or None
def _to_int_or_none(value):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        s = str(value).strip()
        if not s:
            return None
        return int(s)
    except (TypeError, ValueError):
        return None

def create_custom_recurring_tasks_from_intake(db, client, intake, created_by_user_id: int | None = None):
    rules = getattr(intake, "custom_recurring_rules", None) or []
    if isinstance(rules, str):
        try:
            rules = json.loads(rules) or []
        except Exception:
            rules = []

    # resolve schedule type from client frequency
    freq = (client.bookkeeping_frequency or "").lower()
    if "quarter" in freq:
        client_sched = "quarterly"
    elif "annual" in freq or "year" in freq:
        client_sched = "annual"
    else:
        client_sched = "monthly"

    def fallback_assignee():
        return client.bookkeeper_id or client.manager_id or created_by_user_id

    for r in rules:
        title = (r.get("title") or "").strip()
        if not title:
            continue

        # prevent duplicates by rule name
        existing_rule = (
            db.query(models.RecurringTask)
            .filter_by(client_id=client.id, name=title)
            .first()
        )
        if existing_rule:
            continue
        schedule_type = (r.get("schedule_type") or "monthly").strip()
        if schedule_type == "client_frequency":
            schedule_type = client_sched

        day_of_month = r.get("day_of_month")
        assigned_user_id = r.get("assigned_user_id") or fallback_assignee()
        description = r.get("description")

        # start 2�4 weeks after conversion (default 21)
        start_from = date.today() + timedelta(days=21)

        first_due = advance_next_run(
            schedule_type=schedule_type,
            day_of_month=day_of_month or 25,
            weekday=None,
            week_of_month=None,
            from_date=start_from,
        )

        rt = models.RecurringTask(
            name=title,
            description=description,
            schedule_type=schedule_type,
            day_of_month=day_of_month,
            weekday=None,
            week_of_month=None,
            client_id=client.id,
            assigned_user_id=assigned_user_id,
            default_status="open",
            next_run=first_due,
            active=True,
        )
        db.add(rt)
        db.flush()

        due_dt = datetime.combine(first_due, datetime.min.time())

        task = models.Task(
            title=title,
            description=description,
            due_date=due_dt,
            assigned_user_id=assigned_user_id,
            client_id=client.id,
            recurring_task_id=rt.id,
            task_type="recurring",
            status="open",
        )
        db.add(task)

        # advance to next cycle
        rt.next_run = advance_next_run(
            schedule_type,
            first_due,
            day_of_month=rt.day_of_month,
            weekday=rt.weekday,
            week_of_month=rt.week_of_month,
        )
        db.commit()
def create_accounts_from_intake(db, client, intake):
    """
    Auto-create Account records from an intake form.

    Uses:
      - num_checking + checking_banks
      - num_savings + savings_banks
      - num_credit_cards + credit_card_banks
    """
    # ---- Checking accounts ----
    num_checking = _to_int_or_none(getattr(intake, "num_checking", None)) or 0
    checking_banks_str = getattr(intake, "checking_banks", "") or ""
    checking_banks = [b.strip() for b in checking_banks_str.split(",") if b.strip()]

    for i in range(num_checking):
        bank_name = (
            checking_banks[i]
            if i < len(checking_banks)
            else (checking_banks[-1] if checking_banks else "Checking")
        )
        account_name = f"{bank_name} Checking" if bank_name else "Checking Account"

        account = models.Account(
            client_id=client.id,
            name=account_name,
            type="checking",
            last4=None,
            is_active=True,
        )
        db.add(account)

    # ---- Savings accounts ----
    num_savings = _to_int_or_none(getattr(intake, "num_savings", None)) or 0
    savings_banks_str = getattr(intake, "savings_banks", "") or ""
    savings_banks = [b.strip() for b in savings_banks_str.split(",") if b.strip()]

    for i in range(num_savings):
        bank_name = (
            savings_banks[i]
            if i < len(savings_banks)
            else (savings_banks[-1] if savings_banks else "Savings")
        )
        account_name = f"{bank_name} Savings" if bank_name else "Savings Account"

        account = models.Account(
            client_id=client.id,
            name=account_name,
            type="savings",
            last4=None,
            is_active=True,
        )
        db.add(account)
    # ---- Credit card accounts ----
    num_cards = _to_int_or_none(getattr(intake, "num_credit_cards", None)) or 0
    cc_banks_str = getattr(intake, "credit_card_banks", "") or ""
    cc_banks = [b.strip() for b in cc_banks_str.split(",") if b.strip()]

    for i in range(num_cards):
        bank_name = (
            cc_banks[i]
            if i < len(cc_banks)
            else (cc_banks[-1] if cc_banks else "Credit Card")
        )
        account_name = f"{bank_name} Card" if bank_name else "Credit Card"

        account = models.Account(
            client_id=client.id,
            name=account_name,
            type="credit_card",
            last4=None,
            is_active=True,
        )
        db.add(account)
        # -- Loans, Vehicles, Etc could be added similarly --


def create_contacts_from_intake(
    db: Session,
    client: models.Client,
    intake: models.ClientIntake,
):
    """
    Ensure Contact records exist for:
      - The client entity (legal_name)
      - The primary contact person (if provided)

    Then link client.primary_contact_id to the primary contact person.
    """

    # --- Client entity as a Contact (type = entity) ---
    entity_contact = (
        db.query(models.Contact)
        .filter(
            models.Contact.name == client.legal_name,
            models.Contact.is_client == True,
        )
        .first()
    )

    if not entity_contact:
        entity_contact = models.Contact(
            name=client.legal_name,
            email=client.email,
            phone=client.phone,
            type="entity",
            is_client=True,
            notes=None,
        )
        db.add(entity_contact)
        db.flush()  # get id

    # --- Primary contact person as a Contact (type = individual) ---
    primary_name = getattr(intake, "primary_contact_name", None)
    primary_email = getattr(intake, "primary_contact_email", None)
    primary_phone = getattr(intake, "primary_contact_phone", None)

    primary_contact = None
   # If intake already has primary_contact_id, just link it
    if getattr(intake, "primary_contact_id", None):
        primary_contact = (
            db.query(models.Contact)
            .filter(models.Contact.id == intake.primary_contact_id)
            .first()
        )
    else:
        # existing logic using name/email/phone
        if primary_name:
            query = db.query(models.Contact).filter(
                models.Contact.name == primary_name,
            )
            if primary_email:
                query = query.filter(models.Contact.email == primary_email)

            primary_contact = query.first()

            if not primary_contact:
                primary_contact = models.Contact(
                    name=primary_name,
                    email=primary_email,
                    phone=primary_phone,
                    type="individual",
                    is_client=False,
                    notes=None,
                )
                db.add(primary_contact)
                db.flush()

    if primary_contact:
        client.primary_contact_id = primary_contact.id
    # We don't commit here; caller will commit once after all setup.


@router.post("/{intake_id}/convert-to-client", response_model=schemas.ClientOut)
async def convert_intake_to_client(
    intake_id: int,
    convert_in: Optional[schemas.IntakeConvertIn] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a Client from a completed intake form.

    - Body is OPTIONAL. If you send manager_id/bookkeeper_id it will override intake values.
    - If body is omitted, it will use intake.manager_id/intake.bookkeeper_id.
    """
    if convert_in is None:
        convert_in = schemas.IntakeConvertIn()

    intake = (
        db.query(models.ClientIntake)
        .filter(models.ClientIntake.id == intake_id)
        .first()
    )
    if not intake:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake not found")

    # If already converted, just return the existing client
    if getattr(intake, "client_id", None):
        client = (
            db.query(models.Client)
            .filter(models.Client.id == intake.client_id)
            .first()
        )
        if client:
            return client

    # Prefer request body if provided; else fall back to intake stored assignments
    manager_id = convert_in.manager_id if convert_in.manager_id is not None else getattr(intake, "manager_id", None)
    bookkeeper_id = convert_in.bookkeeper_id if convert_in.bookkeeper_id is not None else getattr(intake, "bookkeeper_id", None)

    report_freq = (getattr(intake, "report_frequency", "") or "").lower()

    client = models.Client(
        legal_name=intake.legal_name,
        dba_name=getattr(intake, "dba_name", None),
        primary_contact=getattr(intake, "primary_contact_name", None),
        email=getattr(intake, "primary_contact_email", None),
        phone=getattr(intake, "primary_contact_phone", None),
        tier=report_freq or None,
        billing_frequency=report_freq or None,
        bookkeeping_frequency=report_freq or None,
        cpa=None,
        manager_id=manager_id,
        bookkeeper_id=bookkeeper_id,
    )
    db.add(client)
    db.flush()

    create_contacts_from_intake(db, client, intake)
    create_accounts_from_intake(db, client, intake)

    create_default_recurring_tasks_for_client(db, client, created_by_user_id=current_user.id)
    create_custom_recurring_tasks_from_intake(db, client, intake, created_by_user_id=current_user.id)
    create_onboarding_tasks_for_client(
        db=db,
        client=client,
        created_by_user_id=current_user.id,
    )
    # Create custom recurring tasks from intake (if any)
    raw = getattr(intake, "custom_recurring_rules", None)
    if raw:
        try:
            rules = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            rules = []

        # Import helper if you have it; otherwise inline your next-run logic in create_default_recurring...
        from datetime import date, timedelta
        from .recurring_utils import get_next_run_date  # <- adjust if your helper is elsewhere

        for r in rules or []:
            title = (r.get("title") or "").strip()
            if not title:
                continue

            # idempotent: don't double-create
            existing = (
                db.query(models.RecurringTask)
                .filter(models.RecurringTask.client_id == client.id)
                .filter(models.RecurringTask.name == title)
                .first()
            )
            if existing:
                continue

            schedule_type = (r.get("schedule_type") or "monthly").strip()
            day_of_month = r.get("day_of_month") or 25
            assigned_user_id = r.get("assigned_user_id") or client.bookkeeper_id or current_user.id

            start_from = date.today() + timedelta(days=21)  # 2�4 week delay default
            next_run = get_next_run_date(
                schedule_type=schedule_type,
                day_of_month=day_of_month,
                from_date=start_from,
            )

            rt = models.RecurringTask(
                name=title,
                description=(r.get("description") or None),
                schedule_type=schedule_type,
                day_of_month=day_of_month,
                client_id=client.id,
                assigned_user_id=assigned_user_id,
                default_status="open",
                next_run=next_run,
                active=True,
            )
            db.add(rt)
            db.flush()

            db.add(models.Task(
                title=title,
                description=(r.get("description") or None),
                due_date=datetime.combine(next_run, datetime.min.time()),
                assigned_user_id=assigned_user_id,
                client_id=client.id,
                recurring_task_id=rt.id,
                task_type="recurring",
                status="open",
            ))
    if hasattr(intake, "client_id"):
        intake.client_id = client.id
    if hasattr(intake, "status"):
        intake.status = "completed"
    if hasattr(intake, "converted_at"):
        intake.converted_at = datetime.now()
    if hasattr(intake, "manager_id"):
        intake.manager_id = manager_id
    if hasattr(intake, "bookkeeper_id"):
        intake.bookkeeper_id = bookkeeper_id

    db.commit()
    db.refresh(client)
    return client