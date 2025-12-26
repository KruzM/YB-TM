from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .auth import get_current_user
from .models import Task, Client, User
from .permissions import assert_client_access, is_owner, is_admin
from .schemas import TaskOut

router = APIRouter(prefix="/client-onboarding", tags=["client-onboarding"])



def _is_admin_user(u: User) -> bool:
    return is_owner(u) or is_admin(u)


@router.get("/clients/{client_id}/tasks", response_model=List[TaskOut])
def list_client_onboarding_tasks(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = assert_client_access(db, current_user, client_id)

    q = (
        db.query(Task)
        .options(selectinload(Task.assigned_user))
        .filter(
            Task.client_id == client_id,
            Task.task_type == "onboarding",          # ? only onboarding
            Task.template_task_id.isnot(None),
        )
    )

    # Non-admin users: hide blocked tasks, but allow staff to see the full client onboarding once released
    if not _is_admin_user(current_user):
        q = q.filter(func.lower(Task.status) != "blocked")

    tasks = q.order_by(Task.due_date.asc().nulls_last(), Task.id.asc()).all()
    return tasks