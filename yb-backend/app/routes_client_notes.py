# yb-backend/app/routes_client_notes.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user

router = APIRouter(prefix="/clients/{client_id}/notes", tags=["client-notes"])


def _get_client_or_404(db: Session, client_id: int) -> models.Client:
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


def _note_to_out(note: models.ClientNote) -> schemas.ClientNoteOut:
    return schemas.ClientNoteOut(
        id=note.id,
        client_id=note.client_id,
        body=note.body,
         updated_at=note.updated_at, 
        created_at=note.created_at,
        created_by_id=note.created_by_id,
        created_by_name=note.created_by.name if note.created_by else None,
    )

@router.get("/", response_model=List[schemas.ClientNoteOut])
async def list_client_notes(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_client_or_404(db, client_id)
    notes = (
        db.query(models.ClientNote)
        .filter(models.ClientNote.client_id == client_id)
        .order_by(
            models.ClientNote.pinned.desc(),  # pinned first
            models.ClientNote.created_at.desc(),
        )
        .all()
    )
    return [_note_to_out(n) for n in notes]


@router.post("/", response_model=schemas.ClientNoteOut, status_code=status.HTTP_201_CREATED)
async def create_client_note(
    client_id: int,
    note_in: schemas.ClientNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_client_or_404(db, client_id)

    note = models.ClientNote(
        client_id=client_id,
        body=note_in.body.strip(),
        pinned=bool(note_in.pinned),
        created_by_id=current_user.id if current_user else None,
    )

    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_out(note)


@router.put("/{note_id}", response_model=schemas.ClientNoteOut)
async def update_client_note(
    client_id: int,
    note_id: int,
    note_in: schemas.ClientNoteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_client_or_404(db, client_id)

    note = (
        db.query(models.ClientNote)
        .filter(
            models.ClientNote.id == note_id,
            models.ClientNote.client_id == client_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    data = note_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client_note(
    client_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_client_or_404(db, client_id)

    note = (
        db.query(models.ClientNote)
        .filter(
            models.ClientNote.id == note_id,
            models.ClientNote.client_id == client_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return None
