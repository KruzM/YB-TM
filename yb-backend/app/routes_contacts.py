# app/routes_contacts.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
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


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(current_user)

    c = db.query(models.Contact).get(contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Block deletion if the contact is referenced anywhere important
    client_refs = db.query(models.Client).filter(models.Client.primary_contact_id == contact_id).count()
    intake_refs = (
        db.query(models.ClientIntake)
        .filter(or_(
            models.ClientIntake.primary_contact_id == contact_id,
            models.ClientIntake.cpa_contact_id == contact_id,
        ))
        .count()
    )
    owner_refs = db.query(models.IntakeOwner).filter(models.IntakeOwner.contact_id == contact_id).count()

    if client_refs or intake_refs or owner_refs:
        raise HTTPException(
            status_code=409,
            detail=f"Contact is in use (clients={client_refs}, intakes={intake_refs}, owners={owner_refs}). Unlink it first.",
        )

    db.delete(c)
    db.commit()
    return Response(status_code=204)
