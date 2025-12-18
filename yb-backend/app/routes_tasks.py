# app/routes_tasks.py
from datetime import date, timedelta, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .onboarding import release_onboarding_tasks_if_ready

router = APIRouter(prefix="/tasks", tags=["tasks"])


# --------- Core task CRUD ----------

@router.get("/", response_model=List[schemas.TaskOut])
async def list_tasks(
    q: Optional[str] = None,
    status: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Central list of tasks with optional filters.
    """
    query = db.query(models.Task).filter(
        models.Task.assigned_user_id == current_user.id
    )
    query = query.filter(
    ~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked"))
    )
    if q:
        like = f"%{q}%"
        query = query.filter(models.Task.title.ilike(like))

    if status and status != "all":
        query = query.filter(models.Task.status == status)

    if client_id:
        query = query.filter(models.Task.client_id == client_id)

    # Newest first
    tasks = query.order_by(models.Task.created_at.desc()).all()
    return tasks


@router.post("/", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new ad-hoc task (not from recurring rule).
    """
    assigned_user_id = current_user.id
    if task_in.assigned_user_id is not None and _is_privileged(current_user):
        assigned_user_id = task_in.assigned_user_id

    task_type = task_in.task_type or "ad_hoc"
    task = models.Task(
        title=task_in.title,
        description=task_in.description,
        status=task_in.status or "new",
        due_date=task_in.due_date,
        client_id=task_in.client_id,
        assigned_user_id=assigned_user_id,
        recurring_task_id=task_in.recurring_task_id,
        task_type=task_type,
        created_by_id=current_user.id,
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
    """
    Update a task. Commonly used to change status or due_date.
    """
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    role = (current_user.role or "").strip().lower()
    is_privileged = role in ("admin", "owner")

    if not is_privileged and task.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this task")

    if task_in.title is not None:
        task.title = task_in.title
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.status is not None:
        task.status = task_in.status
    if task_in.due_date is not None:
        task.due_date = task_in.due_date
    if task_in.client_id is not None:
        task.client_id = task_in.client_id

    status_changed_to_completed = (task_in.status is not None and task_in.status.lower() == "completed")

    db.commit()
    db.refresh(task)

    if task.task_type == "onboarding" and task.client_id and status_changed_to_completed:
        release_onboarding_tasks_if_ready(
            db=db,
            client_id=task.client_id,
            created_by_user_id=current_user.id,
    )
    db.refresh(task)  # optional

    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = (
        db.query(models.Task)
        .filter(
            models.Task.id == task_id,
            models.Task.assigned_user_id == current_user.id,

        )
        .first()

    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()
    return None


# --------- Dashboard endpoint ----------

@router.get("/my-dashboard", response_model=schemas.TaskDashboardResponse)
async def get_my_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return tasks for the current user grouped for the dashboard view.
    """
    today = date.today()
    seven_days = today + timedelta(days=7)

    base_q = db.query(models.Task).filter(
        models.Task.assigned_user_id == current_user.id
    )
    base_q = base_q.filter(
        ~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked"))
    )

    # Overdue: due before today (by date), not completed, not waiting_on_client
    overdue = (
        base_q.filter(
            models.Task.due_date.isnot(None),
            func.date(models.Task.due_date) < today,
            models.Task.status != "completed",
            models.Task.status != "waiting_on_client",
        )
        .order_by(models.Task.due_date.asc())
        .all()
    )

    # Today: due today (by date), not completed, not waiting_on_client
    today_tasks = (
        base_q.filter(
            models.Task.due_date.isnot(None),
            func.date(models.Task.due_date) == today,
            models.Task.status != "completed",
            models.Task.status != "waiting_on_client",
        )
        .order_by(models.Task.created_at.asc())
        .all()
    )

    # Upcoming: due in next 7 days (tomorrow .. today+7), not completed, not waiting_on_client
    upcoming = (
        base_q.filter(
            models.Task.due_date.isnot(None),
            func.date(models.Task.due_date) > today,
            func.date(models.Task.due_date) <= seven_days,
            models.Task.status != "completed",
            models.Task.status != "waiting_on_client",
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

    return schemas.TaskDashboardResponse(
        overdue=overdue,
        today=today_tasks,
        upcoming=upcoming,
        waiting_on_client=waiting,
    )

def _ensure_task_visible(task_id: int, db: Session, current_user: models.User) -> models.Task:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if _is_privileged(current_user):
        return task

    # assigned user can always see
    if task.assigned_user_id == current_user.id:
        return task

    # if task is tied to a client, allow that client's manager/bookkeeper to see
    if task.client_id:
        client = db.query(models.Client).filter(models.Client.id == task.client_id).first()
        if client and (client.manager_id == current_user.id or client.bookkeeper_id == current_user.id):
            return task

    raise HTTPException(status_code=404, detail="Task not found")

# --------- Subtasks ----------

@router.get("/{task_id}/subtasks", response_model=List[schemas.TaskSubtaskOut])
async def list_subtasks(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(task_id, db, current_user)
    return (
        db.query(models.TaskSubtask)
        .filter(models.TaskSubtask.task_id == task_id)
        .order_by(models.TaskSubtask.sort_order, models.TaskSubtask.id)
        .all()
    )

@router.post(
    "/{task_id}/subtasks",
    response_model=schemas.TaskSubtaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_subtask(
    task_id: int,
    sub_in: schemas.TaskSubtaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(task_id, db, current_user)
    sub = models.TaskSubtask(task_id=task_id, title=sub_in.title.strip())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put(
    "/{task_id}/subtasks/{sub_id}",
    response_model=schemas.TaskSubtaskOut,
)
async def update_subtask(
    task_id: int,
    sub_id: int,
    sub_in: schemas.TaskSubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(task_id, db, current_user)
    sub = (
        db.query(models.TaskSubtask)
        .filter(
            models.TaskSubtask.id == sub_id,
            models.TaskSubtask.task_id == task_id,
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subtask not found")

    sub.title = sub_in.title.strip()
    sub.is_completed = sub_in.is_completed
    db.commit()
    db.refresh(sub)
    return sub


# --------- Notes ----------

@router.get("/{task_id}/notes", response_model=List[schemas.TaskNoteOut])
async def list_notes(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(task_id, db, current_user)
    notes = (
        db.query(models.TaskNote)
        .filter(models.TaskNote.task_id == task_id)
        .order_by(models.TaskNote.created_at.desc())
        .all()
    )

    # Optionally populate author_name from related User
    result: List[models.TaskNote] = []
    for n in notes:
        if n.author and not getattr(n, "author_name", None):
            # just attach a convenience attribute; Pydantic will map it
            n.author_name = n.author.name or n.author.email  # type: ignore[attr-defined]
        result.append(n)
    return result

@router.post(
    "/{task_id}/notes",
    response_model=schemas.TaskNoteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    task_id: int,
    note_in: schemas.TaskNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(task_id, db, current_user)
    note = models.TaskNote(
        task_id=task_id,
        body=note_in.body.strip(),
        author_id=current_user.id if current_user else None,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    if note.author and not getattr(note, "author_name", None):
        note.author_name = note.author.name or note.author.email  # type: ignore[attr-defined]

    return note


# --------- Helper ----------

def _ensure_task_visible(task_id: int, db: Session, current_user: models.User) -> None:
    """
    Ensure the task exists and belongs to the current user.
    Raises 404 if not visible.
    """
    task = (
        db.query(models.Task)
        .filter(
            models.Task.id == task_id,
            models.Task.assigned_user_id == current_user.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

def _is_privileged(user: models.User) -> bool:
    role = (user.role or "").strip().lower()
    return role in ("admin", "owner")

def _can_access_client(user: models.User, client: models.Client) -> bool:
    if _is_privileged(user):
        return True
    return client.manager_id == user.id or client.bookkeeper_id == user.id

@router.get("/client/{client_id}", response_model=List[schemas.TaskOut])
async def list_tasks_for_client(
    client_id: int,
    task_types: Optional[str] = None,  # comma-separated: "ad_hoc,project"
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not _can_access_client(current_user, client):
        raise HTTPException(status_code=403, detail="Not allowed")

    query = db.query(models.Task).filter(models.Task.client_id == client_id)

    # default: show lifespan one-offs, not onboarding/recurring
    types = [t.strip() for t in (task_types or "").split(",") if t.strip()]
    if types:
        query = query.filter(models.Task.task_type.in_(types))
    else:
        query = query.filter(~models.Task.task_type.in_(["onboarding", "recurring"]))

    # never show blocked onboarding (safety)
    query = query.filter(
        ~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked"))
    )

    if status and status != "all":
        query = query.filter(models.Task.status == status)

    if q:
        like = f"%{q}%"
        query = query.filter(models.Task.title.ilike(like))

    return query.order_by(models.Task.created_at.desc()).all()
