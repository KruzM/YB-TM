from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import ensure_active_user

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(ensure_active_user)])


@router.post("/", response_model=schemas.DocumentRead)
def create_document(doc: schemas.DocumentCreate, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(doc.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found for document")
    if doc.account_id:
        account = db.query(models.Account).get(doc.account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found for document")
    db_doc = models.Document(**doc.model_dump())
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc


@router.get("/", response_model=list[schemas.DocumentRead])
def list_documents(db: Session = Depends(get_db)):
    return db.query(models.Document).all()
