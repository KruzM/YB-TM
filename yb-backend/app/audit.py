# app/audit.py
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from . import models

def log_event(
    db: Session,
    *,
    actor_user_id: int,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    client_id: Optional[int] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> models.AuditEvent:
    evt = models.AuditEvent(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        client_id=client_id,
        meta=meta or None,
    )
    db.add(evt)
    return evt