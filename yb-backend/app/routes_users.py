from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[schemas.UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.User)
        .filter(models.User.is_active == True)
        .order_by(models.User.name)
        .all()
    )
