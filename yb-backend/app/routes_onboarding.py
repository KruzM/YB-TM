from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .database import get_db 
from .auth import require_admin, get_current_user  

from .models import OnboardingTemplateTask, User
from .schemas import (
    OnboardingTemplateTaskCreate,
    OnboardingTemplateTaskUpdate,
    OnboardingTemplateTaskOut,
)

router = APIRouter(prefix="/onboarding-templates", tags=["onboarding-templates"])


@router.get("/", response_model=List[OnboardingTemplateTaskOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    templates = (
        db.query(OnboardingTemplateTask)
        .order_by(
            OnboardingTemplateTask.order_index.asc(),
            OnboardingTemplateTask.id.asc(),
        )
        .all()
    )
    return templates


@router.post("/", response_model=OnboardingTemplateTaskOut)
def create_template(
    payload: OnboardingTemplateTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    tmpl = OnboardingTemplateTask(**payload.dict())
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.put("/{template_id}", response_model=OnboardingTemplateTaskOut)
def update_template(
    template_id: int,
    payload: OnboardingTemplateTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    tmpl = db.query(OnboardingTemplateTask).get(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(tmpl, field, value)

    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    tmpl = db.query(OnboardingTemplateTask).get(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    # soft delete
    tmpl.is_active = False
    db.commit()
    return Response(status_code=204)
