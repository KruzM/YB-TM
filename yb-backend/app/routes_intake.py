# yb-backend/app/routes_intake.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user

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
