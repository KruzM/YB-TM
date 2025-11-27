# app/routes_tasks.py
from typing import List, Optional
from sqlalchemy import func

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .recurring_utils import advance_next_run
from datetime import date, datetime, timedelta
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
    task_in: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    previous_status = task.status

    # apply updates
    for field, value in task_in.dict(exclude_unset=True).items():
        setattr(task, field, value)

    # flush changes so task.status is updated in memory
    db.flush()

    # If this task just transitioned to completed AND is tied to a recurring template,
    # spawn the next instance.
    if (
        previous_status != "completed"
        and task.status == "completed"
        and task.recurring_task_id is not None
    ):
        rt = (
            db.query(models.RecurringTask)
            .filter(models.RecurringTask.id == task.recurring_task_id)
            .first()
        )
        if rt and rt.active:
            # compute next due date
            new_due = advance_next_run(
                rt.schedule_type,
                rt.next_run,
                day_of_month=rt.day_of_month,
                weekday=rt.weekday,
                week_of_month=rt.week_of_month,
            )

            # update rule
            rt.next_run = new_due

            # create new task
            new_task = models.Task(
                title=rt.name,
                description=rt.description or "",
                status=rt.default_status or "new",
                due_date=new_due,
                client_id=rt.client_id,
                assigned_user_id=rt.assigned_user_id or task.assigned_user_id,
                recurring_task_id=rt.id,
            )
            db.add(new_task)

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

@router.get("/my-dashboard", response_model=schemas.TaskDashboardResponse)
async def get_my_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return tasks for the current user grouped for the dashboard view."""
    today = date.today()
    seven_days = today + timedelta(days=7)

    base_q = db.query(models.Task).filter(
        models.Task.assigned_user_id == current_user.id
    )

    # Overdue: due before today (by date), not completed
    overdue = (
        base_q.filter(
            models.Task.due_date != None,  # noqa: E711
            func.date(models.Task.due_date) < today,
            models.Task.status != "completed",
        )
        .order_by(models.Task.due_date.asc())
        .all()
    )

    # Today: due today (by date), not completed
    today_tasks = (
        base_q.filter(
            models.Task.due_date != None,  # noqa: E711
            func.date(models.Task.due_date) == today,
            models.Task.status != "completed",
        )
        .order_by(models.Task.created_at.asc())
        .all()
    )

    # Upcoming: due in next 7 days (tomorrow .. today+7), not completed
    upcoming = (
        base_q.filter(
            models.Task.due_date != None,  # noqa: E711
            func.date(models.Task.due_date) > today,        # strictly after today
            func.date(models.Task.due_date) <= seven_days,  # within next 7 days
            models.Task.status != "completed",
        )
        .order_by(models.Task.due_date.asc())
        .all()
    )

    # Waiting on client: all statuses == waiting_on_client (any due date)
    waiting = (
        base_q.filter(models.Task.status == "waiting_on_client")
        .order_by(models.Task.due_date.asc())
        .all()
    )

    return {
        "overdue": overdue,
        "today": today_tasks,
        "upcoming": upcoming,
        "waiting_on_client": waiting,
    }
