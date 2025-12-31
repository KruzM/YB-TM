# app/schemas.py
from datetime import datetime, date
from typing import Optional, List, Any, Dict
import json
from pydantic import BaseModel, EmailStr, constr, ConfigDict, field_validator



# ---------- User ----------
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str


class UserCreate(UserBase):
    password: str
    manager_id: Optional[int] = None

class UserOut(UserBase):
    id: int
    is_active: bool
    manager_id: Optional[int] = None
    class Config:
        # pydantic v2 equivalent of orm_mode=True
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    manager_id: Optional[int] = None

class UserPasswordResetIn(BaseModel):
    password: Optional[str] = None

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

    # NEW: onboarding / classification
    task_type: str | None = "ad_hoc"  # 'recurring', 'onboarding', 'project', 'ad_hoc'
    onboarding_phase: str | None = None
    template_task_id: int | None = None
    is_intercompany: bool | None = False
    linked_client_ids: Optional[List[int]] = None

class TaskCreate(TaskBase):
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[int] = None
    leave_unassigned: bool = False
    linked_client_ids: Optional[List[int]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    recurring_task_id: Optional[int] = None
    due_date: Optional[datetime] = None
    assigned_user_id: Optional[int] = None
    task_type: Optional[str] = None
    onboarding_phase: Optional[str] = None
    template_task_id: Optional[int] = None

class TaskOut(TaskBase):
    id: int
    due_date: Optional[datetime]
    assigned_user_id: Optional[int]
    assigned_user_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by_id: int | None = None
    class Config:
        from_attributes = True
    is_intercompany: bool | None = False
    linked_client_ids: Optional[List[int]] = None

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
        model_config = ConfigDict(from_attributes=True)



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
        model_config = ConfigDict(from_attributes=True)


# ---------- Recurring Task ----------
class RecurringRuleDraft(BaseModel):
    title: str
    description: Optional[str] = None
    schedule_type: str = "monthly"
    day_of_month: Optional[int] = None
    assigned_user_id: Optional[int] = None

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

# ---------- Recurring Template Task (admin rules) ----------

class RecurringTemplateTaskBase(BaseModel):
    name: str
    description: Optional[str] = None

    # 'client_frequency', 'monthly', 'quarterly', 'annual'
    schedule_type: str = "client_frequency"

    day_of_month: Optional[int] = None
    weekday: Optional[int] = None
    week_of_month: Optional[int] = None

    initial_delay_days: int = 21
    default_assigned_role: Optional[str] = None  # 'bookkeeper'|'manager'|'admin'|None
    default_status: str = "open"

    order_index: int = 0
    is_active: bool = True


class RecurringTemplateTaskCreate(RecurringTemplateTaskBase):
    pass


class RecurringTemplateTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule_type: Optional[str] = None
    day_of_month: Optional[int] = None
    weekday: Optional[int] = None
    week_of_month: Optional[int] = None
    initial_delay_days: Optional[int] = None
    default_assigned_role: Optional[str] = None
    default_status: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class RecurringTemplateTaskOut(RecurringTemplateTaskBase):
    id: int

    class Config:
        from_attributes = True

# ---------- Client ----------
class ClientBase(BaseModel):
    legal_name: str
    dba_name: Optional[str] = None
    tax_id: Optional[str] = None  # EIN or SSN
    tier: Optional[str] = None
    billing_frequency: Optional[str] = None
    bookkeeping_frequency: Optional[str] = None

    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cpa: Optional[str] = None

    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None
    primary_contact_id: Optional[int] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    legal_name: Optional[str] = None
    dba_name: Optional[str] = None
    tax_id: Optional[str] = None
    tier: Optional[str] = None
    billing_frequency: Optional[str] = None
    bookkeeping_frequency: Optional[str] = None

    primary_contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cpa: Optional[str] = None

    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None
    primary_contact_id: Optional[int] = None


class ClientOut(ClientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        

class ClientNoteBase(BaseModel):
    body: str
    pinned: bool | None = False


class ClientNoteCreate(ClientNoteBase):
    pass


class ClientNoteUpdate(BaseModel):
    body: Optional[str] = None
    pinned: Optional[bool] = None


class ClientNoteOut(ClientNoteBase):
    id: int
    client_id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    class Config:
		# or orm_mode 
        from_attributes = True


class IntakeConvertIn(BaseModel):
    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None   


# ---------- Client Intake ----------
class ClientIntakeBase(BaseModel):
    @field_validator("custom_recurring_rules", mode="before")
    @classmethod
    def _parse_custom_rules(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return None
            try:
                return json.loads(s)
            except Exception:
                return None
        return v
    # Basic business info
    legal_name: str
    dba_name: Optional[str] = None
    tax_id: Optional[str] = None  # EIN or SSN
    custom_recurring_rules: Optional[List[RecurringRuleDraft]] = None  # JSON-encoded custom rules
    business_address: Optional[str] = None
    tax_structure: Optional[str] = None
    owners: Optional[str] = None  # "Alice 60%, Bob 40%"

    # Contacts
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None

    # Link to Contact records
    primary_contact_id: Optional[int] = None
    cpa_contact_id: Optional[int] = None

    # Owner Contacts
    owner_contact_ids: Optional[List[int]] = None

    # Bookkeeping / access
    bookkeeping_start_date: Optional[date] = None
    qbo_exists: Optional[bool] = None
    allow_login_access: Optional[bool] = None
    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None   

    # Richer QBO planning fields
    qbo_status: Optional[str] = None                    # 'yes', 'no', 'unsure'
    qbo_num_users: Optional[int] = None
    qbo_needs_class_tracking: Optional[bool] = None
    qbo_needs_location_tracking: Optional[bool] = None
    qbo_recommended_subscription: Optional[str] = None  # 'simple_start','essentials','plus','advanced'

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
    
    # Payroll services requested
    payroll_needs_setup: Optional[bool] = None
    payroll_process_regular: Optional[bool] = None
    payroll_corrections_adjustments: Optional[bool] = None
    payroll_quarterly_filings: Optional[bool] = None
    payroll_state_local_payments: Optional[bool] = None
    payroll_calculate_hours_commission: Optional[bool] = None
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
    tax_id: Optional[str] = None
    business_address: Optional[str] = None
    tax_structure: Optional[str] = None
    owners: Optional[str] = None

    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None

    primary_contact_id: Optional[int] = None
    cpa_contact_id: Optional[int] = None
    owner_contact_ids: Optional[List[int]] = None

    bookkeeping_start_date: Optional[date] = None
    qbo_exists: Optional[bool] = None
    allow_login_access: Optional[bool] = None
    manager_id: Optional[int] = None
    bookkeeper_id: Optional[int] = None

    qbo_status: Optional[str] = None
    qbo_num_users: Optional[int] = None
    qbo_needs_class_tracking: Optional[bool] = None
    qbo_needs_location_tracking: Optional[bool] = None
    qbo_recommended_subscription: Optional[str] = None

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

    payroll_needs_setup: Optional[bool] = None
    payroll_process_regular: Optional[bool] = None
    payroll_corrections_adjustments: Optional[bool] = None
    payroll_quarterly_filings: Optional[bool] = None
    payroll_state_local_payments: Optional[bool] = None
    payroll_calculate_hours_commission: Optional[bool] = None

    custom_recurring_rules: Optional[List[RecurringRuleDraft]] = None
    additional_notes: Optional[str] = None


class ClientIntakeOut(ClientIntakeBase):
    id: int
    status: str
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    client_id: Optional[int] = None

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
    account_id: Optional[int] = None
    doc_type: str = "statement"
    year: int
    month: int
    day: Optional[int] = None
    folder: Optional[str] = None


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
        
# ---------- Onboarding Template Task ----------

class OnboardingTemplateTaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    phase: Optional[str] = None

    # X days after client.created_at for default due date
    default_due_offset_days: Optional[int] = None

    # 'bookkeeper', 'manager', 'admin'
    default_assigned_role: Optional[str] = None

    order_index: int = 0
    is_active: bool = True


class OnboardingTemplateTaskCreate(OnboardingTemplateTaskBase):
    pass


class OnboardingTemplateTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phase: Optional[str] = None
    default_due_offset_days: Optional[int] = None
    default_assigned_role: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class OnboardingTemplateTaskOut(OnboardingTemplateTaskBase):
    id: int

    class Config:
        from_attributes = True

# ---------- Contact ----------

class ContactBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    # 'individual' or 'entity'
    type: str = "individual"

    is_client: bool = False
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    type: Optional[str] = None
    is_client: Optional[bool] = None
    notes: Optional[str] = None


class ContactOut(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- App Settings ----------
class AppSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: Any
    updated_at: Optional[datetime] = None
    updated_by_id: Optional[int] = None

class AppSettingUpsert(BaseModel):
    value: Any

class AppSettingsBulkUpsert(BaseModel):
    settings: Dict[str, Any]

# ---------- Audit Notes ----------
class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_user_id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    client_id: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None
    created_at: datetime

# ---------- Intercompany Task Client Links ----------
class TaskClientLinkUpdate(BaseModel):
    is_completed: bool

class TaskClientLinkOut(BaseModel):
    client_id: int
    client_name: Optional[str] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    completed_by_id: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Client Manual ----------
class ClientManualEntryCreate(BaseModel):
    task_id: Optional[int] = None
    category: str = "general"  # daily/weekly/monthly/quarterly/yearly/projects/general
    title: str
    body: Optional[str] = None

class ClientManualEntryUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    task_id: Optional[int] = None

class ClientManualEntryOut(BaseModel):
    id: int
    client_id: int
    task_id: Optional[int] = None
    category: str
    title: str
    body: Optional[str] = None
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Client Links ----------
class ClientLinkCreate(BaseModel):
    related_client_id: int
    relationship_type: Optional[str] = "intercompany"

class ClientLinkUpdate(BaseModel):
    relationship_type: Optional[str] = None

class ClientLinkOut(BaseModel):
    id: int
    client_id: int
    related_client_id: int
    relationship_type: str
    created_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Quick Notes ----------
class QuickNoteCreate(BaseModel):
    client_id: Optional[int] = None
    body: str

class QuickNoteUpdate(BaseModel):
    client_id: Optional[int] = None
    body: Optional[str] = None

class QuickNoteOut(BaseModel):
    id: int
    client_id: Optional[int] = None
    created_by_id: Optional[int] = None
    body: str
    created_at: datetime

    class Config:
        from_attributes = True