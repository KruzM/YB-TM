# yb-backend/app/routes_client_manual.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .permissions import assert_client_access

router = APIRouter(prefix="/clients/{client_id}/manual", tags=["client-manual"])


@router.get("/", response_model=List[schemas.ClientManualEntryOut])
def list_manual_entries(
    client_id: int,
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    q = db.query(models.ClientManualEntry).filter(models.ClientManualEntry.client_id == client_id)
    if category:
        q = q.filter(models.ClientManualEntry.category == category)

    return q.order_by(models.ClientManualEntry.updated_at.desc()).all()


@router.post("/", response_model=schemas.ClientManualEntryOut, status_code=status.HTTP_201_CREATED)
def create_manual_entry(
    client_id: int,
    entry_in: schemas.ClientManualEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    entry = models.ClientManualEntry(
        client_id=client_id,
        task_id=entry_in.task_id,
        category=(entry_in.category or "general").strip().lower(),
        title=entry_in.title.strip(),
        body=entry_in.body,
        created_by_id=current_user.id if current_user else None,
        updated_by_id=current_user.id if current_user else None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=schemas.ClientManualEntryOut)
def update_manual_entry(
    client_id: int,
    entry_id: int,
    entry_in: schemas.ClientManualEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    entry = (
        db.query(models.ClientManualEntry)
        .filter(
            models.ClientManualEntry.id == entry_id,
            models.ClientManualEntry.client_id == client_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Manual entry not found")
    data = entry_in.model_dump(exclude_unset=True)
    if "category" in data and data["category"] is not None:
        data["category"] = str(data["category"]).strip().lower()
    if "title" in data and data["title"] is not None:
        data["title"] = str(data["title"]).strip()

    for k, v in data.items():
        setattr(entry, k, v)

    entry.updated_by_id = current_user.id if current_user else None

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manual_entry(
    client_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    entry = (
        db.query(models.ClientManualEntry)
        .filter(
            models.ClientManualEntry.id == entry_id,
            models.ClientManualEntry.client_id == client_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Manual entry not found")

    db.delete(entry)
    db.commit()
    return None