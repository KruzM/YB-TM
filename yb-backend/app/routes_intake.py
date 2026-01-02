# yb-backend/app/routes_intake.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Response
from sqlalchemy.orm import Session
from .accounts_seed import seed_default_accounts_for_client
from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin, require_admin_or_owner
from datetime import datetime, date, timedelta
from .onboarding import create_onboarding_tasks_for_client
from .routes_clients import create_default_recurring_tasks_for_client
import json
from .recurring_utils import advance_next_run, next_run_from
router = APIRouter(prefix="/intake", tags=["client-intake"])

def _client_intake_column_names() -> set[str]:
    # Only keep fields that actually exist as SQLAlchemy columns
    return set(models.ClientIntake.__table__.columns.keys())

def _filter_client_intake_columns(data: dict) -> dict:
    cols = _client_intake_column_names()
    return {k: v for k, v in data.items() if k in cols}

def _normalize_bank_value(selected: str | None, other_text: str | None) -> str | None:
    """
    If the select is 'other', replace with the typed value.
    Otherwise return the selected value as-is.
    """
    if selected is None:
        return None
    s = str(selected).strip()
    if not s:
        return None
    if s.lower() == "other":
        o = (other_text or "").strip()
        return o if o else None
    return selected

def _normalize_intake_payload(data: dict) -> dict:
    """
    Central place to normalize incoming intake payload before writing to DB.
    - custom_recurring_rules -> JSON string
    - bank selects 'other' -> use *_other
    """
    # Normalize custom_recurring_rules to JSON string if it's a list/dict
    if "custom_recurring_rules" in data and data["custom_recurring_rules"] is not None:
        if isinstance(data["custom_recurring_rules"], (list, dict)):
            data["custom_recurring_rules"] = json.dumps(data["custom_recurring_rules"])

    # Bank "other" handling
    data["checking_banks"] = _normalize_bank_value(
        data.get("checking_banks"),
        data.get("checking_banks_other"),
    )
    data["savings_banks"] = _normalize_bank_value(
        data.get("savings_banks"),
        data.get("savings_banks_other"),
    )
    data["credit_card_banks"] = _normalize_bank_value(
        data.get("credit_card_banks"),
        data.get("credit_card_banks_other"),
    )

    return data

@router.post("/", response_model=schemas.ClientIntakeOut, status_code=status.HTTP_201_CREATED)
async def create_intake(
    intake_in: schemas.ClientIntakeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = intake_in.model_dump(exclude_unset=True)

    # normalize (custom rules json, banks "other", etc.)
    data = _normalize_intake_payload(data)

    # Pull out owner_contact_ids so we DON'T try to pass it into ClientIntake(...)
    owner_ids = data.pop("owner_contact_ids", None) or []

    # Only pass columns that exist on the model
    data = _filter_client_intake_columns(data)

    intake = models.ClientIntake(
        **data,
        status="new",
        created_by_id=current_user.id if current_user else None,
    )

    db.add(intake)
    db.flush()

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
    intake = db.query(models.ClientIntake).filter(models.ClientIntake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    update_data = intake_in.model_dump(exclude_unset=True)

    # normalize (custom rules json, banks "other", etc.)
    update_data = _normalize_intake_payload(update_data)

    # Handle owner_contact_ids via join table
    owner_ids = update_data.pop("owner_contact_ids", None)

    # Only keep real model columns
    update_data = _filter_client_intake_columns(update_data)

    for field, value in update_data.items():
        setattr(intake, field, value)

    if owner_ids is not None:
        db.query(models.IntakeOwner).filter(models.IntakeOwner.intake_id == intake_id).delete(
            synchronize_session=False
        )
        for cid in owner_ids:
            db.add(models.IntakeOwner(intake_id=intake_id, contact_id=int(cid)))

    db.commit()
    db.refresh(intake)
    return intake

@router.delete("/{intake_id}", status_code=204)
def delete_intake(
    intake_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin_or_owner(current_user)

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

        # start 2-4 weeks after conversion (default 21)
        start_from = date.today() + timedelta(days=21)

        first_due = next_run_from(
            schedule_type,
            start_from,
            day_of_month=day_of_month or 25,
            weekday=None,
            week_of_month=None,
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
    db.flush()
def _pretty_bank_name(v: str | None) -> str:
    if not v:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    # if it's already nice (contains uppercase), don't title-case it
    if any(ch.isupper() for ch in s):
        return s
    # small acronym fixes
    low = s.lower()
    if low in {"amex", "american_express"}:
        return "AmEx"
    if low in {"us_bank", "u.s._bank", "u.s. bank"}:
        return "U.S. Bank"
    if low in {"boa", "bank_of_america"}:
        return "Bank of America"
    return s.replace("_", " ").title()

def _parse_bank_rows_maybe(value):
    """
    Allow checking_banks / savings_banks / credit_card_banks to be:
    - comma-separated string OR
    - JSON list like [{"bank":"chase","count":2}, ...]
    """
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        s = value.strip()
        if s.startswith("[") and s.endswith("]"):
            try:
                return json.loads(s)
            except Exception:
                return None
    return None

def create_accounts_from_intake(db, client, intake):
    # ---- Checking accounts ----
    num_checking = _to_int_or_none(getattr(intake, "num_checking", None)) or 0
    checking_banks_val = getattr(intake, "checking_banks", None)
    checking_other = getattr(intake, "checking_banks_other", None)

    rows = _parse_bank_rows_maybe(checking_banks_val)
    if rows:
        for r in rows:
            bank = r.get("bank")
            count = _to_int_or_none(r.get("count")) or 0
            if str(bank).strip().lower() == "other":
                bank = r.get("bank_other") or checking_other
            bank_name = _pretty_bank_name(bank)
            for _ in range(count):
                db.add(
                    models.Account(
                        client_id=client.id,
                        name=f"{bank_name} Checking" if bank_name else "Checking Account",
                        type="checking",
                        last4=None,
                        is_active=True,
                    )
                )
    else:
        # single value flow
        banks_str = checking_banks_val or ""
        if str(banks_str).strip().lower() == "other":
            banks_str = checking_other or ""
        checking_banks = [b.strip() for b in str(banks_str).split(",") if b.strip()]

        for i in range(num_checking):
            bank_name = (
                checking_banks[i]
                if i < len(checking_banks)
                else (checking_banks[-1] if checking_banks else "Checking")
            )
            bank_name = _pretty_bank_name(bank_name)
            account_name = f"{bank_name} Checking" if bank_name else "Checking Account"
            db.add(
                models.Account(
                    client_id=client.id,
                    name=account_name,
                    type="checking",
                    last4=None,
                    is_active=True,
                )
            )
    # ---- Savings accounts ----
    num_savings = _to_int_or_none(getattr(intake, "num_savings", None)) or 0
    savings_banks_val = getattr(intake, "savings_banks", None)
    savings_other = getattr(intake, "savings_banks_other", None)

    rows = _parse_bank_rows_maybe(savings_banks_val)
    if rows:
        for r in rows:
            bank = r.get("bank")
            count = _to_int_or_none(r.get("count")) or 0
            if str(bank).strip().lower() == "other":
                bank = r.get("bank_other") or savings_other
            bank_name = _pretty_bank_name(bank)
            for _ in range(count):
                db.add(
                    models.Account(
                        client_id=client.id,
                        name=f"{bank_name} Savings" if bank_name else "Savings Account",
                        type="savings",
                        last4=None,
                        is_active=True,
                    )
                )
    else:
        banks_str = savings_banks_val or ""
        if str(banks_str).strip().lower() == "other":
            banks_str = savings_other or ""
        savings_banks = [b.strip() for b in str(banks_str).split(",") if b.strip()]

        for i in range(num_savings):
            bank_name = (
                savings_banks[i]
                if i < len(savings_banks)
                else (savings_banks[-1] if savings_banks else "Savings")
            )
            bank_name = _pretty_bank_name(bank_name)
            account_name = f"{bank_name} Savings" if bank_name else "Savings Account"
            db.add(
                models.Account(
                    client_id=client.id,
                    name=account_name,
                    type="savings",
                    last4=None,
                    is_active=True,
                )
            )

    # ---- Credit card accounts ----
    num_cards = _to_int_or_none(getattr(intake, "num_credit_cards", None)) or 0
    cc_banks_val = getattr(intake, "credit_card_banks", None)
    cc_other = getattr(intake, "credit_card_banks_other", None)

    rows = _parse_bank_rows_maybe(cc_banks_val)
    if rows:
        for r in rows:
            bank = r.get("bank")
            count = _to_int_or_none(r.get("count")) or 0
            if str(bank).strip().lower() == "other":
                bank = r.get("bank_other") or cc_other
            bank_name = _pretty_bank_name(bank)
            for _ in range(count):
                db.add(
                    models.Account(
                        client_id=client.id,
                        name=f"{bank_name} Card" if bank_name else "Credit Card",
                        type="credit_card",
                        last4=None,
                        is_active=True,
                    )
                )
    else:
        banks_str = cc_banks_val or ""
        if str(banks_str).strip().lower() == "other":
            banks_str = cc_other or ""
        cc_banks = [b.strip() for b in str(banks_str).split(",") if b.strip()]
        for i in range(num_cards):
            bank_name = (
                cc_banks[i]
                if i < len(cc_banks)
                else (cc_banks[-1] if cc_banks else "Credit Card")
            )
            bank_name = _pretty_bank_name(bank_name)
            account_name = f"{bank_name} Card" if bank_name else "Credit Card"
            db.add(
                models.Account(
                    client_id=client.id,
                    name=account_name,
                    type="credit_card",
                    last4=None,
                    is_active=True,
                )
            )
# --- Onboarding account shells (Assets / Liabilities / Equity) ---

ONBOARDING_ACCOUNT_SHELLS = [
    # Assets
    ("investment", "Investment Account"),
    ("loan_to_others", "Loan to Others"),
    ("loan_to_shareholders", "Loan to Shareholders"),
    ("vehicle", "Vehicle"),
    ("equipment", "Equipment"),
    ("other_asset", "Other Asset"),

    # Liabilities
    ("line_of_credit", "Line of Credit (LOC)"),
    ("payroll_liability", "Payroll Liabilities"),
    ("vehicle_loan", "Vehicle Loan"),
    ("loan_from_shareholders", "Loan from Shareholders"),
    ("loan_from_others", "Loan from Others"),
    ("mortgage", "Mortgage"),

    # Equity
    ("owner_contributions", "Owner Contributions"),
    ("owner_distributions", "Owner Distributions"),
]


def seed_onboarding_account_shells(db: Session, client: models.Client) -> None:
    """
    Ensure the client has at least one Account row for the standard onboarding list.
    Does NOT duplicate types that already exist for the client.
    """
    existing_types = set(
        t for (t,) in db.query(models.Account.type)
        .filter(models.Account.client_id == client.id)
        .all()
        if t
    )

    def ensure(type_: str, name: str):
        if type_ in existing_types:
            return
        db.add(
            models.Account(
                client_id=client.id,
                name=name,
                type=type_,
                last4=None,
                is_active=True,
            )
        )
        existing_types.add(type_)

    # Ensure at least one of the �statement� base types exists.
    # (If intake already created real bank accounts, these will already exist and be skipped.)
    ensure("checking", "Checking Account")
    ensure("savings", "Savings Account")
    ensure("credit_card", "Credit Card")

    # Seed the rest of the onboarding shells
    for t, name in ONBOARDING_ACCOUNT_SHELLS:
        ensure(t, name)

    db.flush()

def create_contacts_from_intake(
    db: Session,
    client: models.Client,
    intake: models.ClientIntake,
):
    """
    Only create/link a primary contact person if provided.
    Does NOT create a business/entity Contact.
    Links client.primary_contact_id when found/created.
    """

    primary_name = getattr(intake, "primary_contact_name", None)
    primary_email = getattr(intake, "primary_contact_email", None)
    primary_phone = getattr(intake, "primary_contact_phone", None)

    # If there's no primary contact info at all, do nothing
    if not primary_name and not primary_email and not primary_phone and not getattr(intake, "primary_contact_id", None):
        return

    primary_contact = None

    # If intake already has primary_contact_id, just link it
    if getattr(intake, "primary_contact_id", None):
        primary_contact = (
            db.query(models.Contact)
            .filter(models.Contact.id == intake.primary_contact_id)
            .first()
        )
    else:
        # Try to find an existing contact (prefer email if present)
        query = db.query(models.Contact)

        if primary_email:
            query = query.filter(models.Contact.email == primary_email)
        elif primary_name:
            query = query.filter(models.Contact.name == primary_name)
        else:
            # No name/email to match on � can't safely create/find
            return

        primary_contact = query.first()

        if not primary_contact:
            # Only create if we have at least a name or email
            primary_contact = models.Contact(
                name=primary_name or primary_email,  # fallback if no name
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
    if not manager_id or not bookkeeper_id:
            raise HTTPException(
                status_code=400,
                detail="Manager and Bookkeeper must be assigned before converting an intake to a client."
            )
    report_freq = (getattr(intake, "report_frequency", "") or "").lower()
    monthly_tier = getattr(intake, "monthly_close_tier", None)

    tier_value = monthly_tier if report_freq == "monthly" and monthly_tier else (report_freq or None)
    client = models.Client(
        legal_name=intake.legal_name,
        dba_name=getattr(intake, "dba_name", None),
        primary_contact=getattr(intake, "primary_contact_name", None),
        email=getattr(intake, "primary_contact_email", None),
        phone=getattr(intake, "primary_contact_phone", None),
        tier=tier_value,
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
    seed_onboarding_account_shells(db, client)
    seed_default_accounts_for_client(db, client.id)
    create_default_recurring_tasks_for_client(db, client, created_by_user_id=current_user.id)
    create_custom_recurring_tasks_from_intake(db, client, intake, created_by_user_id=current_user.id)
    create_onboarding_tasks_for_client(
        db=db,
        client=client,
        created_by_user_id=current_user.id,
    )
        # Update intake to link to new client
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