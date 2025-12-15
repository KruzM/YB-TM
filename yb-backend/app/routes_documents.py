# app/routes_documents.py
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_admin
from datetime import date
router = APIRouter(prefix="/documents", tags=["documents"])

# Adjust this base path to match your actual documents directory
BASE_DOCS_DIR = Path("/home/kruzer04/YBTM/YB-TM/docs")


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


@router.post("/upload", response_model=schemas.DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    client_id: int = Form(...),
    account_id: int = Form(...),
    statement_date: date = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    account = db.query(models.Account).get(account_id)
    if not account or account.client_id != client_id:
        raise HTTPException(status_code=400, detail="Invalid account/client combo")

    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    year = statement_date.year
    month = statement_date.month
    day = statement_date.day

    client_folder = BASE_DOCS_DIR / f"{client.legal_name}"
    stmt_folder = client_folder / "Statements"
    account_folder = stmt_folder / (account.name or f"Account-{account.id}")
    year_folder = account_folder / str(year)
    year_folder.mkdir(parents=True, exist_ok=True)

    month_str = f"{month:02d}"
    day_str = f"{day:02d}"
    year_two = str(year)[-2:]
    ext = Path(file.filename).suffix or ".pdf"
    stored_filename = f"{month_str}{day_str}{year_two}{ext}"

    stored_path = year_folder / stored_filename

    with stored_path.open("wb") as f:
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
        stored_path=str(stored_path),
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
    """
    Return the file to the browser for viewing/downloading.
    """
    doc = db.query(models.Document).get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = Path(doc.stored_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    #key part: force inline instead of attachment
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=doc.stored_filename,  # or doc.original_filename
        content_disposition_type="inline",
    )



@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """
    Delete a document and its file from disk.
    Admin only.
    """
    doc = db.query(models.Document).get(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = Path(doc.stored_path)
    if path.exists():
        try:
            path.unlink()
        except OSError:
            # If file deletion fails, still remove DB record, but you could log this.
            pass

    db.delete(doc)
    db.commit()
    return None

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
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    year = document_date.year
    month = document_date.month
    day = document_date.day

    client_folder = BASE_DOCS_DIR / f"{client.legal_name}"
    docs_root = client_folder / "Documents"
    target_folder = docs_root / (folder or str(year))
    target_folder.mkdir(parents=True, exist_ok=True)

    month_str = f"{month:02d}"
    day_str = f"{day:02d}"
    year_two = str(year)[-2:]
    ext = Path(file.filename).suffix or ".pdf"
    stored_filename = f"{month_str}{day_str}{year_two}{ext}"

    stored_path = target_folder / stored_filename

    with stored_path.open("wb") as f:
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
        stored_path=str(stored_path),
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
