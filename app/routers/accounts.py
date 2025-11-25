from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import ensure_active_user

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(ensure_active_user)])


@router.post("/", response_model=schemas.AccountRead)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
    client = db.query(models.Client).get(account.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found for account")
    db_account = models.Account(**account.model_dump())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.get("/", response_model=list[schemas.AccountRead])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(models.Account).all()
