# app/auth.py
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas

SECRET_KEY = os.getenv("YB_SECRET_KEY") or ""
if not SECRET_KEY:
    raise RuntimeError("YB_SECRET_KEY environment variable is not set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 8* 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    """Validate JWT from Authorization header or access_token cookie."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    token: Optional[str] = None

    # 1) Prefer Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    # 2) Fall back to access_token cookie
    if token is None:
        raw_cookie = request.cookies.get("access_token")
        if raw_cookie:
            if raw_cookie.lower().startswith("bearer "):
                token = raw_cookie.split(" ", 1)[1].strip()
            else:
                token = raw_cookie.strip()

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).get(int(user_id))
    if not user or not user.is_active:
        raise credentials_exception

    return user

def role_required(*roles: str):
    allowed = {r.strip().lower() for r in roles}

    def _dep(current_user: models.User = Depends(get_current_user)):
        user_role = (current_user.role or "").strip().lower()
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return _dep

# main dependencies
require_bookkeeper = role_required("Bookkeeper")
require_bookkeeper_or_manager = role_required("Bookkeeper", "Manager")
require_staff = role_required("Bookkeeper", "Manager", "Admin", "Owner")

# Convenience shortcuts
require_admin = role_required("Admin")
require_owner = role_required("Owner")
require_admin_or_owner = role_required("Admin", "Owner")
require_client = role_required("Client")
# Manager-level
require_manager = role_required("Manager")
require_manager_or_admin = role_required("Manager", "Admin", "Owner")