# app/routes_accounts.py
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .permissions import assert_client_access
from .accounts_seed import seed_default_accounts_for_client
router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/", response_model=List[schemas.AccountOut])
async def list_accounts(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List accounts for a given client.
    client_id is required (query param).
    """
    assert_client_access(db, current_user, client_id)

    accounts = (
        db.query(models.Account)
        .filter(models.Account.client_id == client_id)
        .order_by(models.Account.name)
        .all()
    )
    return accounts

@router.post("/seed-defaults/{client_id}", response_model=List[schemas.AccountOut])
async def seed_defaults(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, client_id)
    seed_default_accounts_for_client(db, client_id)
    db.commit()

    return (
        db.query(models.Account)
        .filter(models.Account.client_id == client_id)
        .order_by(models.Account.name)
        .all()
    )

@router.post(
    "/", response_model=schemas.AccountOut, status_code=status.HTTP_201_CREATED
)
async def create_account(
    account_in: schemas.AccountCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_access(db, current_user, account_in.client_id)

    # Optional: verify client exists
    client = (
        db.query(models.Client)
        .filter(models.Client.id == account_in.client_id)
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    account = models.Account(**account_in.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/{account_id}", response_model=schemas.AccountOut)
async def update_account(
    account_id: int,
    account_in: schemas.AccountUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = (
        db.query(models.Account)
        .filter(models.Account.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    assert_client_access(db, current_user, account.client_id)


    for field, value in account_in.dict(exclude_unset=True).items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = (
        db.query(models.Account)
        .filter(models.Account.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    assert_client_access(db, current_user, account.client_id)

    db.delete(account)
    db.commit()
    return None
