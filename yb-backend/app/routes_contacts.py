# app/routes_contacts.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/", response_model=List[schemas.ContactOut])
async def list_contacts(
    q: Optional[str] = Query(
        default=None,
        description="Search by name, email, or phone",
    ),
    type_filter: Optional[str] = Query(
        default=None,
        alias="type",
        description="Filter by type: individual or entity",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List contacts, with optional search and type filter.
    This will be used for dropdowns on intake/client forms.
    """
    query = db.query(models.Contact)

    if q:
        like = f"%{q}%"
        query = query.filter(
            models.Contact.name.ilike(like)
            | models.Contact.email.ilike(like)
            | models.Contact.phone.ilike(like)
        )

    if type_filter:
        query = query.filter(models.Contact.type == type_filter)

    return (
        query.order_by(models.Contact.name.asc())
        .all()
    )


@router.post("/", response_model=schemas.ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_in: schemas.ContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new contact.
    Can be used when the user clicks 'Add new contact' from a dropdown.
    """
    contact = models.Contact(**contact_in.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=schemas.ContactOut)
async def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=schemas.ContactOut)
async def update_contact(
    contact_id: int,
    contact_in: schemas.ContactUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Update a contact (name, email, phone, type, notes, etc.).
    """
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for field, value in contact_in.dict(exclude_unset=True).items():
        setattr(contact, field, value)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Delete a contact.
    We require admin here to avoid accidental deletions.
    """
    require_admin(current_user)

    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()
    return None
