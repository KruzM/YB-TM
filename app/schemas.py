from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, constr

from app.models import Role, TaskStatus, RecurringSchedule, DocumentType


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool = True


class UserCreate(UserBase):
    # bcrypt only supports passwords up to 72 bytes; enforce a limit so validation
    # fails cleanly instead of letting hashing raise a ValueError.
    password: constr(max_length=72)


class UserRead(UserBase):
    id: int

    class Config:
        from_attributes = True


class ContactBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class ContactCreate(ContactBase):
    pass


class ContactRead(ContactBase):
    id: int

    class Config:
        from_attributes = True


class ClientBase(BaseModel):
    legal_name: str
    dba_name: Optional[str] = None
    primary_contact_id: Optional[int] = None
    cpa: Optional[str] = None
    bookkeeping_frequency: Optional[str] = None
    billing_frequency: Optional[str] = None
    manager_id: Optional[int] = None
    tier: Optional[str] = None
    intercompany_group_id: Optional[int] = None


class ClientCreate(ClientBase):
    pass


class ClientRead(ClientBase):
    id: int

    class Config:
        from_attributes = True


class AccountBase(BaseModel):
    client_id: int
    bank_name: str
    type: str
    last4: str
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountRead(AccountBase):
    id: int

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    client_id: int
    assigned_user_id: Optional[int] = None
    due_date: Optional[date] = None
    recurring_id: Optional[int] = None
    status: TaskStatus = TaskStatus.new
    priority: str = "normal"
    task_type: Optional[str] = None
    notes: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskRead(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubtaskBase(BaseModel):
    parent_task_id: int
    account_id: Optional[int] = None
    name: str
    status: TaskStatus = TaskStatus.new


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskRead(SubtaskBase):
    id: int

    class Config:
        from_attributes = True


class RecurringTaskBase(BaseModel):
    client_id: int
    schedule_type: RecurringSchedule = RecurringSchedule.monthly
    first_run_date: Optional[date] = None
    rule_logic: Optional[str] = None
    template_name: str


class RecurringTaskCreate(RecurringTaskBase):
    pass


class RecurringTaskRead(RecurringTaskBase):
    id: int

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    client_id: int
    account_id: Optional[int] = None
    type: DocumentType = DocumentType.misc
    month: Optional[int] = None
    year: Optional[int] = None
    filename: str
    stored_path: str
    uploaded_by_id: Optional[int] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    id: int
    uploaded_date: datetime

    class Config:
        from_attributes = True
