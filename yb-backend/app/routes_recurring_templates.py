from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin

router = APIRouter(prefix="/recurring-templates", tags=["recurring templates"])


@router.get("/", response_model=List[schemas.RecurringTemplateTaskOut])
def list_recurring_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.RecurringTemplateTask)
        .order_by(models.RecurringTemplateTask.order_index.asc())
        .all()
    )


@router.post("/", response_model=schemas.RecurringTemplateTaskOut, status_code=status.HTTP_201_CREATED)
def create_recurring_template(
    tpl_in: schemas.RecurringTemplateTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)

    tpl = models.RecurringTemplateTask(**tpl_in.model_dump())
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.put("/{tpl_id}", response_model=schemas.RecurringTemplateTaskOut)
def update_recurring_template(
    tpl_id: int,
    tpl_in: schemas.RecurringTemplateTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)

    tpl = db.query(models.RecurringTemplateTask).get(tpl_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    data = tpl_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(tpl, k, v)

    db.commit()
    db.refresh(tpl)
    return tpl

@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_template(
    tpl_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)

    tpl = db.query(models.RecurringTemplateTask).get(tpl_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(tpl)
    db.commit()
    return None