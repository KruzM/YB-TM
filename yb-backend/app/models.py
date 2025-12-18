# app/models.py
from __future__ import annotations
from enum import Enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="bookkeeper")  # admin/manager/bookkeeper/client
    is_active = Column(Boolean, default=True)

    # Tasks assigned to this user
    tasks = relationship(
        "Task",
        back_populates="assigned_user",
        foreign_keys="Task.assigned_user_id",
    )

    # (optional) tasks they created - handy but not required
    created_tasks = relationship(
        "Task",
        foreign_keys="Task.created_by_id",
        back_populates="created_by",
    )

# Contact Model
class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)

    # Display fields
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # 'individual' or 'entity'
    type = Column(String, nullable=False, default="individual")

    # True if this contact represents a client in the system
    is_client = Column(Boolean, nullable=False, default=False)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

# Client Model
class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    legal_name = Column(String, nullable=False)
    dba_name = Column(String, nullable=True)
    tier = Column(String, nullable=True)  # monthly / quarterly / annual / etc.
    billing_frequency = Column(String, nullable=True)
    bookkeeping_frequency = Column(String, nullable=True)
    
    primary_contact = Column(String, nullable=True)  # keeping simple for now
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    cpa = Column(String, nullable=True)

    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bookkeeper_id = Column(Integer, ForeignKey("users.id"), nullable=True)


    notes = relationship(
        "ClientNote",
        back_populates="client",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    #link to a Contact record for primary contact
    primary_contact_id = Column(
        Integer,
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    #relationship to Contact
    primary_contact_contact = relationship("Contact")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=False)

    # Example: "WF Checking 2356"
    name = Column(String, nullable=False)

    # checking, savings, credit_card, loan, line_of_credit, asset, other
    type = Column(String, nullable=True)

    # last 4 digits of account number
    last4 = Column(String(4), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ClientPurgeRequest(Base):
    __tablename__ = "client_purge_requests"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    status = Column(String, default="pending")  # pending / executed / cancelled

    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    client = relationship("Client")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=False)

    # NOW nullable so general docs can be client-level (no specific account)
    account_id = Column(Integer, ForeignKey("accounts.id"), index=True, nullable=True)

    # "statement", "document", "tax", etc.
    doc_type = Column(String, nullable=False, default="statement")

    # Optional logical folder (Tax, Legal, Payroll, etc.)
    folder = Column(String, nullable=True)

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    day = Column(Integer, nullable=True)  # optional day for MMDDYY naming

    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)  # just "MMDDYY.ext"
    stored_path = Column(String, nullable=False)      # full relative path from root

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ClientIntake(Base):
    __tablename__ = "client_intake"

    id = Column(Integer, primary_key=True, index=True)

    # Workflow status
    status = Column(String, default="new", index=True)  # new / in_progress / completed / archived

    # Basic business info
    legal_name = Column(String, nullable=False, index=True)
    dba_name = Column(String, nullable=True)
    business_address = Column(String, nullable=True)
    tax_structure = Column(String, nullable=True)  # LLC, S-Corp, etc.
    owners = Column(Text, nullable=True)  # free-text description of owners & %s

    # Contacts
    primary_contact_name = Column(String, nullable=True)
    primary_contact_email = Column(String, nullable=True)
    primary_contact_phone = Column(String, nullable=True)

    #contact links
    primary_contact_id = Column(
        Integer,
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )
    cpa_contact_id = Column(
        Integer,
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )

    # Bookkeeping / access
    bookkeeping_start_date = Column(Date, nullable=True)
    qbo_exists = Column(Boolean, default=False)
    allow_login_access = Column(Boolean, default=True)

    # Internal staffing (set after discovery call, before conversion)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bookkeeper_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    manager = relationship("User", foreign_keys=[manager_id], lazy="joined")
    bookkeeper = relationship("User", foreign_keys=[bookkeeper_id], lazy="joined")

    # 'yes', 'no', or 'unsure'
    qbo_status = Column(String, nullable=True)
    qbo_num_users = Column(Integer, nullable=True)
    qbo_needs_class_tracking = Column(Boolean, default=False, nullable=False)
    qbo_needs_location_tracking = Column(Boolean, default=False, nullable=False)
    # 'simple_start', 'essentials', 'plus', 'advanced'
    qbo_recommended_subscription = Column(String, nullable=True)

    # Banking / accounts
    num_checking = Column(Integer, nullable=True)
    checking_banks = Column(Text, nullable=True)
    num_savings = Column(Integer, nullable=True)
    savings_banks = Column(Text, nullable=True)
    num_credit_cards = Column(Integer, nullable=True)
    credit_card_banks = Column(Text, nullable=True)
    loans = Column(Text, nullable=True)
    vehicles = Column(Text, nullable=True)
    assets = Column(Text, nullable=True)

    # Transactions / behavior
    payment_methods = Column(Text, nullable=True)  # ACH, checks, Square, etc.
    non_business_deposits = Column(Boolean, default=False)
    personal_expenses_in_business = Column(Boolean, default=False)
    business_expenses_in_personal = Column(Boolean, default=False)

    # Reporting / payroll
    report_frequency = Column(String, nullable=True)  # monthly / quarterly / annually
    income_tracking = Column(Text, nullable=True)
    payroll_provider = Column(String, nullable=True)

    # Payroll services requested
    payroll_needs_setup = Column(Boolean, default=False, nullable=False)
    payroll_process_regular = Column(Boolean, default=False, nullable=False)
    payroll_corrections_adjustments = Column(Boolean, default=False, nullable=False)
    payroll_quarterly_filings = Column(Boolean, default=False, nullable=False)
    payroll_state_local_payments = Column(Boolean, default=False, nullable=False)
    payroll_calculate_hours_commission = Column(Boolean, default=False, nullable=False)

    # Misc
    additional_notes = Column(Text, nullable=True)
    
    # Relationships to Contact rows
    primary_contact_contact = relationship(
        "Contact",
        foreign_keys=[primary_contact_id],
        lazy="joined",
    )
    cpa_contact_contact = relationship(
        "Contact",
        foreign_keys=[cpa_contact_id],
        lazy="joined",
    )
    owners_contacts = relationship(
        "Contact",
        secondary="intake_owners",
        lazy="joined",
    )
    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined")

   
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )
  # If converted to client, link to client record
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)


class ClientNote(Base):
    __tablename__ = "client_notes"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    body = Column(Text, nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    client = relationship("Client", back_populates="notes")
    created_by = relationship("User", lazy="joined")


class IntakeOwner(Base):
    __tablename__ = "intake_owners"

    intake_id = Column(Integer, ForeignKey("client_intake.id"), primary_key=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), primary_key=True)

    intake = relationship("ClientIntake", backref="intake_owner_links")
    contact = relationship("Contact")

class RecurringTask(Base):
    __tablename__ = "recurring_tasks"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # 'monthly', 'quarterly', 'annual'
    schedule_type = Column(String, nullable=False)

    # Either use day_of_month OR (weekday + week_of_month)
    day_of_month = Column(Integer, nullable=True)
    weekday = Column(Integer, nullable=True)        # 0=Mon..6=Sun
    week_of_month = Column(Integer, nullable=True)  # 1..4 or -1 for last

    next_run = Column(Date, nullable=False)

    default_status = Column(String, nullable=False, default="new")
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
class OnboardingTemplateTask(Base):
    __tablename__ = "onboarding_template_tasks"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Used to group tasks in the client onboarding tab
    phase = Column(String, nullable=True)  # e.g. "Pre-QBO Setup", "Bank Feeds"

    # X days after client.created_at to set the due date
    default_due_offset_days = Column(Integer, nullable=True)

    # 'bookkeeper', 'manager', 'admin' 
    default_assigned_role = Column(String, nullable=True)

    # Order for display
    order_index = Column(Integer, nullable=False, default=0)

    # Soft on/off
    is_active = Column(Boolean, nullable=False, default=True)

    # Back-reference from Task
    generated_tasks = relationship(
        "Task",
        back_populates="template_task",
        cascade="all, delete-orphan",
    )

    #---------- Task ----------
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="new")
    due_date = Column(DateTime, nullable=True)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_id = Column(Integer, nullable=True)  # later can be FK to clients

    recurring_task_id = Column(
        Integer,
        ForeignKey("recurring_tasks.id"),
        nullable=True,
        index=True,
    )

    # onboarding / task classification fields
    task_type = Column(
        String,
        nullable=False,
        default="ad_hoc",  # 'recurring', 'onboarding', 'project', 'ad_hoc'
    )

    # grouping for onboarding tab
    onboarding_phase = Column(String, nullable=True)

    # link back to the template row that created this task (if any)
    template_task_id = Column(
        Integer,
        ForeignKey("onboarding_template_tasks.id"),
        nullable=True,
    )
    @property
    def assigned_user_name(self):
        if self.assigned_user:
         return self.assigned_user.name or self.assigned_user.email
        return None
    # who created this task
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    assigned_user = relationship(
        "User",
        back_populates="tasks",
        foreign_keys=[assigned_user_id],
    )

    created_by = relationship(
        "User",
        back_populates="created_tasks",
        foreign_keys=[created_by_id],
    )

    template_task = relationship(
        "OnboardingTemplateTask",
        back_populates="generated_tasks",
    )

    subtasks = relationship(
        "TaskSubtask",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    notes = relationship(
        "TaskNote",
        back_populates="task",
        cascade="all, delete-orphan",
    )

class TaskSubtask(Base):
    __tablename__ = "task_subtasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    task = relationship("Task", back_populates="subtasks")


class TaskNote(Base):
    __tablename__ = "task_notes"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    task = relationship("Task", back_populates="notes")
    author = relationship("User")