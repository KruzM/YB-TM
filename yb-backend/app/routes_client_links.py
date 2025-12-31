# yb-backend/app/routes_client_links.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .permissions import assert_client_access

router = APIRouter(prefix="/clients/{client_id}/links", tags=["client-links"])


@router.get("/", response_model=List[schemas.ClientLinkOut])
def list_client_links(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)
    return (
        db.query(models.ClientLink)
        .filter(models.ClientLink.client_id == client_id)
        .order_by(models.ClientLink.created_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.ClientLinkOut, status_code=status.HTTP_201_CREATED)
def create_client_link(
    client_id: int,
    link_in: schemas.ClientLinkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)
    assert_client_access(db, current_user, link_in.related_client_id)

    link = models.ClientLink(
        client_id=client_id,
        related_client_id=link_in.related_client_id,
        relationship_type=(link_in.relationship_type or "intercompany").strip().lower(),
        created_by_id=current_user.id if current_user else None,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.put("/{link_id}", response_model=schemas.ClientLinkOut)
def update_client_link(
    client_id: int,
    link_id: int,
    link_in: schemas.ClientLinkUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    link = (
        db.query(models.ClientLink)
        .filter(models.ClientLink.id == link_id, models.ClientLink.client_id == client_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    data = link_in.model_dump(exclude_unset=True)
    if "relationship_type" in data and data["relationship_type"] is not None:
        link.relationship_type = str(data["relationship_type"]).strip().lower()

    db.commit()
    db.refresh(link)
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_link(
    client_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)

    link = (
        db.query(models.ClientLink)
        .filter(models.ClientLink.id == link_id, models.ClientLink.client_id == client_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
    return None
