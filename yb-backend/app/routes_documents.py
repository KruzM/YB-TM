# app/routes_documents.py
from typing import List, Optional
from pathlib import Path
from datetime import date
import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin
from .models import AppSetting
from .permissions import assert_client_upload_allowed, assert_client_access


router = APIRouter(prefix="/documents", tags=["documents"])

# Default docs path (used if no app_setting exists)
DEFAULT_DOCS_DIR = Path("/home/kruzer04/YBTM/YB-TM/docs")


def _safe_folder_name(name: str) -> str:
    """
    Sanitize folder names so client/account names can't break paths.
    """
    name = (name or "").strip()
    name = re.sub(r"[\\/]+", "_", name)              # remove slashes
    name = re.sub(r"[^a-zA-Z0-9 _.-]", "", name)     # remove odd chars
    return name.strip() or "Client"


def _get_docs_root(db: Session) -> Path:
    """
    Returns the docs root path from app_settings.docs_root_path if set,
    otherwise DEFAULT_DOCS_DIR.
    """
    row = db.query(AppSetting).filter(AppSetting.key == "docs_root_path").first()
    if row and isinstance(row.value, str) and row.value.strip():
        return Path(row.value).expanduser()
    return DEFAULT_DOCS_DIR
def _abs_doc_path(db: Session, stored_path: str) -> Path:
    """
    Convert a stored_path (relative preferred) into an absolute Path under docs_root.
    If an old record accidentally stored an absolute path, we still allow it.
    """
    p = Path(stored_path)

    # If legacy absolute path exists, use it directly
    if p.is_absolute():
        return p

    return _get_docs_root(db) / p


@router.get("/", response_model=List[schemas.DocumentOut])
def list_documents(
    client_id: Optional[int] = None,
    account_id: Optional[int] = None,
    year: Optional[int] = None,
    doc_type: Optional[str] = None,
    folder: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Access control:
    # - If client_id or account_id is provided, user must have access to that client
    # - Otherwise, only owner/admin can list all documents
    role = (current_user.role or "").strip().lower()
    if client_id is not None:
        assert_client_access(db, current_user, client_id)
    elif account_id is not None:
        acct = db.query(models.Account).filter(models.Account.id == account_id).first()
        if not acct:
            raise HTTPException(status_code=404, detail="Account not found")
        assert_client_access(db, current_user, acct.client_id)
    elif role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to list all documents")

    q = db.query(models.Document)

    if client_id is not None:
        q = q.filter(models.Document.client_id == client_id)
    if account_id is not None:
        q = q.filter(models.Document.account_id == account_id)
    if year is not None:
        q = q.filter(models.Document.year == year)
    if doc_type is not None:
        q = q.filter(models.Document.doc_type == doc_type)
    if folder is not None:
        q = q.filter(models.Document.folder == folder)

    return q.order_by(
        models.Document.client_id.asc(),
        models.Document.account_id.asc().nullsfirst(),
        models.Document.year.asc(),
        models.Document.month.asc(),
    ).all()
@router.post(
    "/upload",
    response_model=schemas.DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    client_id: int = Form(...),
    account_id: int = Form(...),
    statement_date: date = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Enforce client upload permissions (supports future client portal rules)
    assert_client_upload_allowed(db, current_user, client_id)

    account = db.query(models.Account).get(account_id)
    if not account or account.client_id != client_id:
        raise HTTPException(status_code=400, detail="Invalid account/client combo")

    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    year = statement_date.year
    month = statement_date.month
    day = statement_date.day

    docs_root = _get_docs_root(db)
    client_folder = _safe_folder_name(client.legal_name)
    account_folder_name = _safe_folder_name(account.name or f"Account-{account.id}")

    month_str = f"{month:02d}"
    day_str = f"{day:02d}"
    year_two = str(year)[-2:]
    ext = Path(file.filename).suffix or ".pdf"
    stored_filename = f"{month_str}{day_str}{year_two}{ext}"

    # Store RELATIVE path in DB (NAS-ready)
    relative_path = (
        Path(client_folder)
        / "Statements"
        / account_folder_name
        / str(year)
        / stored_filename
    )
    abs_path = docs_root / relative_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    with abs_path.open("wb") as f:
        f.write(await file.read())

    doc = models.Document(
        client_id=client_id,
        account_id=account_id,
        doc_type="statement",
        folder="Statements",
        year=year,
        month=month,
        day=day,
        original_filename=file.filename,
        stored_filename=stored_filename,
        stored_path=str(relative_path),  # <-- RELATIVE stored
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post(
    "/upload-general",
    response_model=schemas.DocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_general_document(
    client_id: int = Form(...),
    document_date: date = Form(...),
    folder: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assert_client_upload_allowed(db, current_user, client_id)

    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    year = document_date.year
    month = document_date.month
    day = document_date.day

    docs_root = _get_docs_root(db)
    client_folder = _safe_folder_name(client.legal_name)

    month_str = f"{month:02d}"
    day_str = f"{day:02d}"
    year_two = str(year)[-2:]
    ext = Path(file.filename).suffix or ".pdf"
    stored_filename = f"{month_str}{day_str}{year_two}{ext}"
    # folder can be like "Payroll" or "Tax" etc.
    safe_folder = _safe_folder_name(folder) if folder else str(year)

    relative_path = (
        Path(client_folder)
        / "Documents"
        / safe_folder
        / stored_filename
    )

    abs_path = docs_root / relative_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    with abs_path.open("wb") as f:
        f.write(await file.read())

    doc = models.Document(
        client_id=client_id,
        account_id=None,
        doc_type="document",
        folder=folder,
        year=year,
        month=month,
        day=day,
        original_filename=file.filename,
        stored_filename=stored_filename,
        stored_path=str(relative_path),  # <-- RELATIVE stored
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    assert_client_access(db, current_user, doc.client_id)

    abs_path = _abs_doc_path(db, doc.stored_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Force inline viewing
    return FileResponse(
        abs_path,
        media_type="application/pdf",
        filename=doc.stored_filename,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    doc = db.query(models.Document).get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    abs_path = _abs_doc_path(db, doc.stored_path)
    if abs_path.exists():
        try:
            abs_path.unlink()
        except OSError:
            # If file deletion fails, still remove DB record
            pass

    db.delete(doc)
    db.commit()
    return None