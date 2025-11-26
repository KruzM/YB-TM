# app/routes_tasks.py
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=List[schemas.TaskOut])
async def list_tasks(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Task)

    if status:
        query = query.filter(models.Task.status == status)

    # later we can filter by current_user.id for "my tasks"
    tasks = query.order_by(models.Task.due_date).all()
    return tasks


@router.post("/", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = models.Task(
        title=task_in.title,
        description=task_in.description,
        status=task_in.status or "new",
        due_date=task_in.due_date,
        assigned_user_id=task_in.assigned_user_id or current_user.id,
        client_id=task_in.client_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
async def update_task(
    task_id: int,
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.title = task_in.title
    task.description = task_in.description
    task.status = task_in.status or task.status
    task.due_date = task_in.due_date
    task.assigned_user_id = (
        task_in.assigned_user_id or task.assigned_user_id or current_user.id
    )
    task.client_id = task_in.client_id

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return None
