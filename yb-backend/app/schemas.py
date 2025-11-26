# app/schemas.py
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ---------- User ----------
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool

    class Config:
        # pydantic v2 equivalent of orm_mode=True
        from_attributes = True


# ---------- Auth ----------
class TokenData(BaseModel):
    user_id: int
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Task ----------
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "new"
    client_id: Optional[int] = None


class TaskCreate(TaskBase):
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[int] = None


class TaskOut(TaskBase):
    id: int
    due_date: Optional[datetime]
    assigned_user_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Client ----------
class ClientBase(BaseModel):
    legal_name: str
    dba_name: Optional[str] = None
    tier: Optional[str] = None
    billing_frequency: Optional[str] = None
    bookkeeping_frequency: Optional[str] = None

    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cpa: Optional[str] = None

    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    pass


class ClientOut(ClientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True