from datetime import datetime, date
from sqlalchemy import Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    bookkeeper = "bookkeeper"
    client = "client"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(Role), default=Role.bookkeeper, nullable=False)

    tasks = relationship("Task", back_populates="assignee")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)

    clients = relationship("Client", back_populates="primary_contact")


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    legal_name = Column(String, nullable=False)
    dba_name = Column(String)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id"))
    cpa = Column(String)
    bookkeeping_frequency = Column(String)
    billing_frequency = Column(String)
    manager_id = Column(Integer, ForeignKey("users.id"))
    tier = Column(String)
    intercompany_group_id = Column(Integer, index=True, nullable=True)

    primary_contact = relationship("Contact", back_populates="clients")
    accounts = relationship("Account", back_populates="client")
    tasks = relationship("Task", back_populates="client")
    documents = relationship("Document", back_populates="client")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    bank_name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    last4 = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    client = relationship("Client", back_populates="accounts")
    documents = relationship("Document", back_populates="account")
    subtasks = relationship("Subtask", back_populates="account")


class RecurringSchedule(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    annually = "annually"
    custom = "custom"


class TaskStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting_on_client = "waiting_on_client"
    completed = "completed"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)
    recurring_id = Column(Integer, ForeignKey("recurring_tasks.id"), nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.new, nullable=False)
    priority = Column(String, default="normal")
    task_type = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks")
    recurring_task = relationship("RecurringTask", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task")


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    name = Column(String, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.new, nullable=False)

    task = relationship("Task", back_populates="subtasks")
    account = relationship("Account", back_populates="subtasks")


class RecurringTask(Base):
    __tablename__ = "recurring_tasks"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    schedule_type = Column(Enum(RecurringSchedule), default=RecurringSchedule.monthly, nullable=False)
    first_run_date = Column(Date, nullable=True)
    rule_logic = Column(String)
    template_name = Column(String, nullable=False)

    tasks = relationship("Task", back_populates="recurring_task")


class DocumentType(str, enum.Enum):
    statement = "statement"
    tax_document = "tax_document"
    misc = "misc"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    type = Column(Enum(DocumentType), default=DocumentType.misc, nullable=False)
    month = Column(Integer)
    year = Column(Integer)
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_date = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="documents")
    account = relationship("Account", back_populates="documents")
