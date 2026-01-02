# app/routes_auth.py
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    email: str,
    password: str,
    response: Response,
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # cookie matches token lifetime (helps if you use cookie auth anywhere)
    response.set_cookie(
        "access_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=schemas.UserOut)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# One-time helper to create the first admin user
@router.post("/init-admin", response_model=schemas.UserOut)
async def init_admin(
    user_in: schemas.UserCreate, db: Session = Depends(get_db)
):
    """
    Bootstrap endpoint for a fresh install ONLY.

    Security:
    - Only works if there are zero users in the database.
    - Always creates an OWNER user (ignores role from payload).
    """
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=403, detail="init-admin is disabled")

    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    admin = models.User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        role="owner",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
