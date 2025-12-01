# app/schemas.py
from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, EmailStr, constr


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
    description: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    client_id: int | None = None
    assigned_user_id: int | None = None
    recurring_task_id: int | None = None

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

class TaskSubtaskBase(BaseModel):
    title: constr(min_length=1, max_length=255)

class TaskSubtaskCreate(TaskSubtaskBase):
    pass

class TaskSubtaskUpdate(TaskSubtaskBase):
    is_completed: bool

class TaskSubtaskOut(TaskSubtaskBase):
    id: int
    is_completed: bool
    created_at: datetime

    class Config:
        orm_mode = True


class TaskNoteBase(BaseModel):
    body: constr(min_length=1)

class TaskNoteCreate(TaskNoteBase):
    pass

class TaskNoteOut(TaskNoteBase):
    id: int
    task_id: int
    author_id: int | None = None
    author_name: str | None = None  # you can populate this in a property or query
    created_at: datetime

    class Config:
        orm_mode = True

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
        
# ---------- Client Intake ----------
class ClientIntakeBase(BaseModel):
    # Basic business info
    legal_name: str
    dba_name: Optional[str] = None
    business_address: Optional[str] = None
    tax_structure: Optional[str] = None
    owners: Optional[str] = None  # "Alice 60%, Bob 40%"

    # Contacts
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None

    # Bookkeeping / access
    bookkeeping_start_date: Optional[date] = None
    qbo_exists: Optional[bool] = None
    allow_login_access: Optional[bool] = None

    # Banking / accounts
    num_checking: Optional[int] = None
    checking_banks: Optional[str] = None
    num_savings: Optional[int] = None
    savings_banks: Optional[str] = None
    num_credit_cards: Optional[int] = None
    credit_card_banks: Optional[str] = None
    loans: Optional[str] = None
    vehicles: Optional[str] = None
    assets: Optional[str] = None

    # Transactions / behavior
    payment_methods: Optional[str] = None
    non_business_deposits: Optional[bool] = None
    personal_expenses_in_business: Optional[bool] = None
    business_expenses_in_personal: Optional[bool] = None

    # Reporting / payroll
    report_frequency: Optional[str] = None
    income_tracking: Optional[str] = None
    payroll_provider: Optional[str] = None

    # Misc
    additional_notes: Optional[str] = None


class ClientIntakeCreate(ClientIntakeBase):
    """All fields from the base model; legal_name is required there already."""
    pass


class ClientIntakeUpdate(BaseModel):
    """Partial update; everything is optional."""
    status: Optional[str] = None  # new / in_progress / completed / archived

    legal_name: Optional[str] = None
    dba_name: Optional[str] = None
    business_address: Optional[str] = None
    tax_structure: Optional[str] = None
    owners: Optional[str] = None

    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None

    bookkeeping_start_date: Optional[date] = None
    qbo_exists: Optional[bool] = None
    allow_login_access: Optional[bool] = None

    num_checking: Optional[int] = None
    checking_banks: Optional[str] = None
    num_savings: Optional[int] = None
    savings_banks: Optional[str] = None
    num_credit_cards: Optional[int] = None
    credit_card_banks: Optional[str] = None
    loans: Optional[str] = None
    vehicles: Optional[str] = None
    assets: Optional[str] = None

    payment_methods: Optional[str] = None
    non_business_deposits: Optional[bool] = None
    personal_expenses_in_business: Optional[bool] = None
    business_expenses_in_personal: Optional[bool] = None

    report_frequency: Optional[str] = None
    income_tracking: Optional[str] = None
    payroll_provider: Optional[str] = None

    additional_notes: Optional[str] = None


class ClientIntakeOut(ClientIntakeBase):
    id: int
    status: str
    created_by_id: Optional[int] = None
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