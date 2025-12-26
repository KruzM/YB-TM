# app/routes_recurring.py
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_manager_or_admin
from .recurring_utils import advance_next_run

router = APIRouter(prefix="/recurring-tasks", tags=["recurring tasks"])


def _create_task_from_rule(
    db: Session,
    rule: models.RecurringTask,
) -> models.Task:
    """
    Helper: create a concrete Task instance from a RecurringTask rule
    at rule.next_run.
    """
    if not rule.next_run:
        raise ValueError("RecurringTask.next_run must be set to generate a task.")

    task = models.Task(
        title=rule.name,
        description=rule.description or "",
        status=rule.default_status or "new",
        due_date=rule.next_run,
        assigned_user_id=rule.assigned_user_id,
        client_id=rule.client_id,
        recurring_task_id=rule.id,
        task_type="recurring",
    )
    db.add(task)
    return task


@router.get("/", response_model=List[schemas.RecurringTaskOut])
def list_recurring_tasks(
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List recurring task rules.
    Anyone logged in can view (Bookkeepers, Managers, Admins, Owner).
    """
    q = db.query(models.RecurringTask)
    if client_id is not None:
        q = q.filter(models.RecurringTask.client_id == client_id)

    return q.order_by(models.RecurringTask.next_run.asc()).all()

@router.post(
    "/", response_model=schemas.RecurringTaskOut, status_code=status.HTTP_201_CREATED
)
def create_recurring_task(
    rt_in: schemas.RecurringTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin),
):
    """
    Create a new recurring rule for a client.
    Only Manager / Admin / Owner can create.
    """
    rule = models.RecurringTask(
        name=rt_in.name,
        description=rt_in.description,
        schedule_type=rt_in.schedule_type,
        day_of_month=rt_in.day_of_month,
        weekday=rt_in.weekday,
        week_of_month=rt_in.week_of_month,
        client_id=rt_in.client_id,
        assigned_user_id=rt_in.assigned_user_id,
        default_status=rt_in.default_status,
        next_run=rt_in.next_run,
        active=True,
    )
    db.add(rule)
    db.flush()  # Get rule.id populated
    # Create the initial concrete task for next_run
    due = rule.next_run
    _create_task_from_rule(db, rule)

    rule.next_run = advance_next_run(
        rule.schedule_type,
        due,
        day_of_month=rule.day_of_month,
        weekday=rule.weekday,
        week_of_month=rule.week_of_month,
    )

    db.commit()
    db.refresh(rule)
    return rule


@router.get("/{rt_id}", response_model=schemas.RecurringTaskOut)
def get_recurring_task(
    rt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get a single recurring rule by id.
    """
    rule = db.query(models.RecurringTask).get(rt_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    return rule

@router.put("/{rt_id}", response_model=schemas.RecurringTaskOut)
def update_recurring_task(
    rt_id: int,
    rt_in: schemas.RecurringTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin),
):
    """
    Update an existing recurring rule.
    Only Manager / Admin / Owner can update.
    """
    rule = db.query(models.RecurringTask).get(rt_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    # Apply updates
    data = rt_in.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_task(
    rt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager_or_admin),
):
    """
    Delete a recurring rule.
    Only Manager / Admin / Owner can delete.
    (Existing concrete tasks are left as-is.)
    """
    rule = db.query(models.RecurringTask).get(rt_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    db.delete(rule)
    db.commit()
    return None