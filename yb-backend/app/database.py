# yb-backend/app/database.py
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ---- build an absolute path to yb_app.db ----
# This file lives at: YBTM/YB-TM/yb-backend/app/database.py
# We want the DB at:  YBTM/yb_app.db   (two levels up from yb-backend)
BASE_DIR = Path(__file__).resolve().parents[2]   # -> .../YBTM
DB_PATH = BASE_DIR / "yb_app.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
