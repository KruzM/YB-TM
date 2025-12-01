# yb-backend/app/routes_intake.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from datetime import datetime

from .routes_clients import create_default_recurring_tasks_for_client
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
    intake = models.ClientIntake(
        **intake_in.model_dump(),
        status="new",
        created_by_id=current_user.id if current_user else None,
    )
    db.add(intake)
    db.commit()
    db.refresh(intake)
    return intake


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
    intake = db.query(models.ClientIntake).filter(models.ClientIntake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    update_data = intake_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(intake, field, value)

    db.commit()
    db.refresh(intake)
    return intake


@router.delete("/{intake_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intake(
    intake_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Hard-delete an intake record.
    In the future we might switch this to 'archived' instead of delete.
    """
    intake = db.query(models.ClientIntake).filter(models.ClientIntake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    db.delete(intake)
    db.commit()
    return None
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


def create_accounts_from_intake(db, client, intake):
    """
    Auto-create Account records from an intake form.

    Uses:
      - num_checking + checking_banks
      - num_savings + savings_banks
      - num_credit_cards + credit_card_banks
    """
    # You may need to import models at top: from . import models

    # ---- Checking accounts ----
    num_checking = _to_int_or_none(getattr(intake, "num_checking", None)) or 0
    checking_banks_str = getattr(intake, "checking_banks", "") or ""
    checking_banks = [b.strip() for b in checking_banks_str.split(",") if b.strip()]

    for i in range(num_checking):
        # Use the i-th bank if available, otherwise fall back to last specified
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


@router.post("/{intake_id}/convert-to-client", response_model=schemas.ClientOut)
async def convert_intake_to_client(
    intake_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a Client from a completed intake form.

    - Maps core intake fields into the Client model.
    - Auto-creates bank/credit accounts from intake answers.
    - Creates default recurring tasks for the new client.
    - Links intake.client_id + converted_at.
    """
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

    # Map intake ? client fields (adjust field names if needed)
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
        manager_id=None,
        bookkeeper_id=None,
    )

    db.add(client)
    db.flush()  # so client.id is available

    # ?? NEW: create Accounts based on intake answers
    create_accounts_from_intake(db, client, intake)

    # ?? Also create default recurring rules/tasks (if you already had this helper)
    create_default_recurring_tasks_for_client(db, client, current_user)

    # Link intake ? client and mark as converted
    if hasattr(intake, "client_id"):
        intake.client_id = client.id
    if hasattr(intake, "status"):
        intake.status = "completed"
    if hasattr(intake, "converted_at"):
        intake.converted_at = datetime.utcnow()

    db.commit()
    db.refresh(client)
    return client