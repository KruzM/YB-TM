# yb-backend/app/routes_quick_notes.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .permissions import assert_client_access, is_admin, is_owner

router = APIRouter(prefix="/quick-notes", tags=["quick-notes"])


def _can_edit_note(user: models.User, note: models.QuickNote) -> bool:
    if is_owner(user) or is_admin(user):
        return True
    return note.created_by_id == user.id


@router.get("/", response_model=List[schemas.QuickNoteOut])
def list_quick_notes(
    client_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.QuickNote)

    if client_id is not None:
        assert_client_access(db, current_user, client_id)
        q = q.filter(models.QuickNote.client_id == client_id)

    if not (is_owner(current_user) or is_admin(current_user)):
        q = q.filter(models.QuickNote.created_by_id == current_user.id)

    return q.order_by(models.QuickNote.created_at.desc()).limit(limit).all()


@router.post("/", response_model=schemas.QuickNoteOut, status_code=status.HTTP_201_CREATED)
def create_quick_note(
    note_in: schemas.QuickNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if note_in.client_id is not None:
        assert_client_access(db, current_user, note_in.client_id)

    note = models.QuickNote(
        client_id=note_in.client_id,
        body=note_in.body.strip(),
        created_by_id=current_user.id if current_user else None,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
@router.put("/{note_id}", response_model=schemas.QuickNoteOut)
def update_quick_note(
    note_id: int,
    note_in: schemas.QuickNoteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = db.query(models.QuickNote).filter(models.QuickNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Quick note not found")

    if not _can_edit_note(current_user, note):
        raise HTTPException(status_code=403, detail="Not allowed")

    data = note_in.model_dump(exclude_unset=True)

    if "client_id" in data:
        # Allow clearing or setting, but must have access when setting
        if data["client_id"] is not None:
            assert_client_access(db, current_user, data["client_id"])
        note.client_id = data["client_id"]

    if "body" in data and data["body"] is not None:
        note.body = str(data["body"]).strip()

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = db.query(models.QuickNote).filter(models.QuickNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Quick note not found")

    if not _can_edit_note(current_user, note):
        raise HTTPException(status_code=403, detail="Not allowed")

    db.delete(note)
    db.commit()
    return None