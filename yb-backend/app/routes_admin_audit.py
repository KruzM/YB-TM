from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import require_admin_or_owner

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])

@router.get("", response_model=List[schemas.AuditEventOut])
def list_audit_events(
    client_id: Optional[int] = None,
    actor_user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    q = db.query(models.AuditEvent)

    if client_id is not None:
        q = q.filter(models.AuditEvent.client_id == client_id)
    if actor_user_id is not None:
        q = q.filter(models.AuditEvent.actor_user_id == actor_user_id)
    if action:
        q = q.filter(models.AuditEvent.action.ilike(f"%{action}%"))
    if entity_type:
        q = q.filter(models.AuditEvent.entity_type.ilike(f"%{entity_type}%"))

    limit = max(1, min(limit, 1000))
    return q.order_by(models.AuditEvent.created_at.desc()).limit(limit).all()