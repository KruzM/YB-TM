# app/routes_auth.py
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
async def login(
    response: Response, email: str, password: str, db: Session = Depends(get_db)
):
    user = authenticate_user(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=60)
    token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=access_token_expires,
    )

    # Cookie for Swagger / non-React usage
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=60 * 60,
        samesite="lax",
        secure=False,
    )

    # Token body for React
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
    existing = (
        db.query(models.User).filter(models.User.email == user_in.email).first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    admin = models.User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
