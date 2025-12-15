from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user
from .models import Task, Client, User
from .schemas import TaskOut

router = APIRouter(prefix="/client-onboarding", tags=["client-onboarding"])


@router.get("/clients/{client_id}/tasks", response_model=List[TaskOut])
def list_client_onboarding_tasks(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # sanity check so we return 404 instead of silent empty if client is bogus
    client = db.query(Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tasks = (
        db.query(Task)
        .filter(
            Task.client_id == client_id,
            Task.template_task_id.isnot(None),  # only tasks generated from templates
        )
        .order_by(Task.due_date.asc().nulls_last(), Task.id.asc())
        .all()
    )
    return tasks
