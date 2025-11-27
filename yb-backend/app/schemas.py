# app/schemas.py
from datetime import datetime, date
from typing import Optional, List

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
    recurring_task_id: Optional[int] = None

class TaskCreate(TaskBase):
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    recurring_task_id: Optional[int] = None
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

class TaskDashboardResponse(BaseModel):
    overdue: List[TaskOut]
    today: List[TaskOut]
    upcoming: List[TaskOut]
    waiting_on_client: List[TaskOut]

# ---------- Recurring Task ----------

class RecurringTaskBase(BaseModel):
    name: str
    description: Optional[str] = None

    schedule_type: str  # 'monthly', 'quarterly', 'annual'

    day_of_month: Optional[int] = None
    weekday: Optional[int] = None        # 0=Mon..6=Sun
    week_of_month: Optional[int] = None  # 1..4 or -1 for last

    client_id: Optional[int] = None
    assigned_user_id: Optional[int] = None

    default_status: str = "new"
    next_run: date                      # first due date


class RecurringTaskCreate(RecurringTaskBase):
    pass


class RecurringTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule_type: Optional[str] = None
    day_of_month: Optional[int] = None
    weekday: Optional[int] = None
    week_of_month: Optional[int] = None
    client_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    default_status: Optional[str] = None
    next_run: Optional[date] = None
    active: Optional[bool] = None


class RecurringTaskOut(RecurringTaskBase):
    id: int
    active: bool
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

# ---------- Account ----------
class AccountBase(BaseModel):
    client_id: int
    name: str
    type: Optional[str] = None
    last4: Optional[str] = None
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    last4: Optional[str] = None
    is_active: Optional[bool] = None


class AccountOut(AccountBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- Document ----------
class DocumentBase(BaseModel):
    client_id: int
    account_id: int
    doc_type: str = "statement"
    year: int
    month: int
    day: Optional[int] = None


class DocumentCreate(DocumentBase):
    original_filename: str
    stored_filename: str
    stored_path: str


class DocumentOut(DocumentBase):
    id: int
    original_filename: str
    stored_filename: str
    stored_path: str
    uploaded_by: int
    uploaded_at: datetime

    class Config:
        from_attributes = True

# ---------- Client Purge Request ----------
class ClientPurgeRequestOut(BaseModel):
    id: int
    client_id: int
    status: str
    requested_by_id: int
    approved_by_id: Optional[int]
    created_at: datetime
    approved_at: Optional[datetime]
    executed_at: Optional[datetime]

    class Config:
        from_attributes = True