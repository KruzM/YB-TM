from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import require_admin_or_owner

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])

@router.get("/", response_model=List[schemas.AppSettingOut])
def list_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    return db.query(models.AppSetting).order_by(models.AppSetting.key.asc()).all()

@router.get("/{key}", response_model=schemas.AppSettingOut)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    return row

@router.put("/{key}", response_model=schemas.AppSettingOut)
def upsert_setting(
    key: str,
    payload: schemas.AppSettingUpsert,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if row:
        row.value = payload.value
        row.updated_by_id = current_user.id
    else:
        row = models.AppSetting(
            key=key,
            value=payload.value,
            updated_by_id=current_user.id,
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    return row

@router.put("/", response_model=List[schemas.AppSettingOut])
def bulk_upsert_settings(
    payload: schemas.AppSettingsBulkUpsert,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    out = []
    for key, value in payload.settings.items():
        row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
        if row:
            row.value = value
            row.updated_by_id = current_user.id
        else:
            row = models.AppSetting(key=key, value=value, updated_by_id=current_user.id)
            db.add(row)
        out.append(row)

    db.commit()
    # refresh rows so updated_at is present
    for r in out:
        db.refresh(r)
    return out
