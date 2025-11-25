from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import ensure_active_user

router = APIRouter(prefix="/recurring-tasks", tags=["recurring"], dependencies=[Depends(ensure_active_user)])


@router.post("/", response_model=schemas.RecurringTaskRead)
def create_recurring(recurring: schemas.RecurringTaskCreate, db: Session = Depends(get_db)):
    db_recurring = models.RecurringTask(**recurring.model_dump())
    db.add(db_recurring)
    db.commit()
    db.refresh(db_recurring)
    return db_recurring


@router.get("/", response_model=list[schemas.RecurringTaskRead])
def list_recurring(db: Session = Depends(get_db)):
    return db.query(models.RecurringTask).all()
