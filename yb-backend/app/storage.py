# app/storage.py
from pathlib import Path
import os
from sqlalchemy.orm import Session
from fastapi import HTTPException

from .models import AppSetting

DEFAULT_DOCS_DIR = Path("/home/kruzer04/YBTM/YB-TM/docs")

def get_docs_root(db: Session | None = None) -> Path:
    # Env override is ideal for prod deployments
    env = os.getenv("YECNY_DOCS_ROOT")
    if env and env.strip():
        return Path(env).expanduser().resolve()

    if db is not None:
        row = db.query(AppSetting).filter(AppSetting.key == "docs_root_path").first()
        if row and isinstance(row.value, str) and row.value.strip():
            return Path(row.value).expanduser().resolve()

    return DEFAULT_DOCS_DIR.resolve()

def _is_under(p: Path, root: Path) -> bool:
    try:
        p.relative_to(root)
        return True
    except ValueError:
        return False

def abs_doc_path(db: Session, stored_path: str) -> Path:
    root = get_docs_root(db)
    p = Path(stored_path)

    abs_p = (p if p.is_absolute() else (root / p)).expanduser().resolve()

    # Security: do NOT allow serving/deleting arbitrary paths
    if not _is_under(abs_p, root):
        raise HTTPException(status_code=500, detail=f"Refusing path outside docs root: {abs_p}")

    return abs_p
