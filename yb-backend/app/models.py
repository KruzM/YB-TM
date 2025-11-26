# app/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

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
    
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="new")
    due_date = Column(DateTime, nullable=True)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    client_id = Column(Integer, nullable=True)  # later will FK to clients

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    assigned_user = relationship("User", back_populates="tasks")