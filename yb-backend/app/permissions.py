# app/permissions.py
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from . import models

def _role(user: models.User) -> str:
    return (user.role or "").strip().lower()

def is_owner(user): return _role(user) == "owner"
def is_admin(user): return _role(user) == "admin"
def is_manager(user): return _role(user) == "manager"
def is_bookkeeper(user): return _role(user) == "bookkeeper"
def is_client(user): return _role(user) == "client"

def assert_client_access(db: Session, user: models.User, client_id: int) -> models.Client:
    """
    Throws 403 if user cannot access this client.
    Returns the Client row if allowed.
    """
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Global access
    if is_owner(user) or is_admin(user):
        return client

    # Staff access by assignment (simple and effective)
    if is_manager(user) and client.manager_id == user.id:
        return client
    if is_bookkeeper(user) and client.bookkeeper_id == user.id:
        return client

    # Portal users (or shared access) via join table
    link = (
        db.query(models.ClientUserAccess)
        .filter(
            models.ClientUserAccess.client_id == client_id,
            models.ClientUserAccess.user_id == user.id,
        )
        .first()
    )
    if link:
        return client

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized for this client",
    )

def assert_client_upload_allowed(db: Session, user: models.User, client_id: int):
    # Owner/Admin already covered by assert_client_access
    assert_client_access(db, user, client_id)

    if is_owner(user) or is_admin(user):
        return

    link = (
        db.query(models.ClientUserAccess)
        .filter(
            models.ClientUserAccess.client_id == client_id,
            models.ClientUserAccess.user_id == user.id,
        )
        .first()
    )
    if is_client(user) and (not link or not link.can_upload_docs):
        raise HTTPException(status_code=403, detail="Upload not allowed")
