from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import ensure_active_user

router = APIRouter(prefix="/contacts", tags=["contacts"], dependencies=[Depends(ensure_active_user)])


@router.post("/", response_model=schemas.ContactRead)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.get("/", response_model=list[schemas.ContactRead])
def list_contacts(db: Session = Depends(get_db)):
    return db.query(models.Contact).all()
