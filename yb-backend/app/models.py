# app/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
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

    tasks = relationship("Task", back_populates="assigned_user")

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

    created_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
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
    account_id = Column(Integer, ForeignKey("accounts.id"), index=True, nullable=False)

    # "statement", "tax", etc. - for now we just use "statement"
    doc_type = Column(String, nullable=False, default="statement")

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    day = Column(Integer, nullable=True)  # optional day for MMDDYY naming

    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)  # just "MMDDYY.ext"
    stored_path = Column(String, nullable=False)      # full relative path from root

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

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
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="new")
    due_date = Column(DateTime, nullable=True)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_id = Column(Integer, nullable=True)  # later will FK to clients

    recurring_task_id = Column(
        Integer,
        ForeignKey("recurring_tasks.id"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    assigned_user = relationship("User", back_populates="tasks")