# app/routes_users.py
from typing import List, Optional
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_password_hash, require_admin_or_owner, require_staff

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_ROLES = {"bookkeeper", "manager", "admin", "owner", "client"}


def _normalize_role(role: Optional[str]) -> Optional[str]:
    if role is None:
        return None
    return role.strip().lower()


def _generate_temp_password(length: int = 14) -> str:
    # Avoid ambiguous chars for readability (optional)
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("/", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    """
    List all users.
    Staff can view (helps with assignments).
    """
    return db.query(models.User).order_by(models.User.name.asc()).all()


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    """
    Create a new user.
    Only Admin/Owner.
    """
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    role = _normalize_role(user_in.role) or "bookkeeper"
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Allowed: {sorted(ALLOWED_ROLES)}",
        )

    user = models.User(
        email=user_in.email.strip().lower(),
        name=user_in.name.strip(),
        hashed_password=get_password_hash(user_in.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    """
    Update user fields (name/email/role/is_active).
    Only Admin/Owner.
    """
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)

    # Email uniqueness check
    if "email" in data and data["email"] is not None:
        new_email = data["email"].strip().lower()
        existing = (
            db.query(models.User)
            .filter(models.User.email == new_email, models.User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = new_email
    if "name" in data and data["name"] is not None:
        user.name = data["name"].strip()

    if "role" in data and data["role"] is not None:
        new_role = _normalize_role(data["role"])
        if new_role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Allowed: {sorted(ALLOWED_ROLES)}",
            )
        user.role = new_role

    if "is_active" in data and data["is_active"] is not None:
        # prevent locking yourself out by accident
        if user_id == current_user.id and data["is_active"] is False:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account.",
            )
        user.is_active = bool(data["is_active"])

    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: schemas.UserPasswordResetIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_owner),
):
    """
    Reset a user's password.
    Only Admin/Owner.
    If payload.password is omitted, a temporary password is generated and returned.
    """
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = payload.password.strip() if payload.password else _generate_temp_password()

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user.hashed_password = get_password_hash(new_password)
    db.commit()

    return {
        "message": "Password reset successfully.",
        "temporary_password": new_password,
    }