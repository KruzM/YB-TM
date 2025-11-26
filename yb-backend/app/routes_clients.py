# app/routes_clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import get_db
from . import models, schemas
from .auth import get_current_user

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=List[schemas.ClientOut])
async def list_clients(
    q: Optional[str] = None,
    tier: Optional[str] = None,
    manager_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Client)

    if q:
        query = query.filter(models.Client.legal_name.ilike(f"%{q}%"))

    if tier:
        query = query.filter(models.Client.tier == tier)

    if manager_id:
        try:
            manager_id_int = int(manager_id)
            query = query.filter(models.Client.manager_id == manager_id_int)
        except ValueError:
            # ignore bad value, treat as no filter
            pass


    return query.order_by(models.Client.legal_name).all()


@router.post("/", response_model=schemas.ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    new_client = models.Client(**client_in.dict())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client


@router.get("/{client_id}", response_model=schemas.ClientOut)
async def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=schemas.ClientOut)
async def update_client(
    client_id: int,
    client_in: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for field, value in client_in.dict(exclude_unset=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    db.delete(client)
    db.commit()
    return None
