# app/routes_tasks.py
from datetime import date, timedelta, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .onboarding import release_onboarding_tasks_if_ready
from .permissions import assert_client_access, can_view_task, is_admin, is_owner

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _is_privileged(user: models.User) -> bool:
    role = (user.role or "").strip().lower()
    return role in ("admin", "owner")


def _ensure_task_visible(db: Session, current_user: models.User, task_id: int) -> models.Task:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not can_view_task(db, current_user, task):
        # Avoid leaking existence
        raise HTTPException(status_code=404, detail="Task not found")

    return task


def _task_linked_client_ids(db: Session, task: models.Task) -> Optional[List[int]]:
    if not bool(getattr(task, "is_intercompany", False)):
        return None
    try:
        links = db.query(models.TaskClientLink).filter(models.TaskClientLink.task_id == task.id).all()
        return [l.client_id for l in links]
    except Exception:
        return None


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
    Personal task list:
    - Non-privileged: tasks assigned to me
    - Privileged: also defaults to tasks assigned to me (Admin uses /unassigned for unassigned queue)
    """
    query = db.query(models.Task).filter(models.Task.assigned_user_id == current_user.id)

    # never show blocked onboarding in normal lists
    query = query.filter(~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked")))

    if q:
        query = query.filter(models.Task.title.ilike(f"%{q}%"))

    if status and status != "all":
        query = query.filter(models.Task.status == status)

    if client_id:
        query = query.filter(models.Task.client_id == client_id)

    tasks = query.order_by(models.Task.created_at.desc()).all()

    # populate linked_client_ids for intercompany
    for t in tasks:
        try:
            t.linked_client_ids = _task_linked_client_ids(db, t)  # type: ignore[attr-defined]
        except Exception:
            pass

    return tasks
@router.get("/unassigned", response_model=List[schemas.TaskOut])
async def list_unassigned_tasks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _is_privileged(current_user):
        raise HTTPException(status_code=403, detail="Not allowed")

    tasks = (
        db.query(models.Task)
        .filter(models.Task.assigned_user_id.is_(None))
        .order_by(models.Task.created_at.desc())
        .all()
    )
    for t in tasks:
        try:
            t.linked_client_ids = _task_linked_client_ids(db, t)  # type: ignore[attr-defined]
        except Exception:
            pass
    return tasks


@router.post("/", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new task.
    - Non-privileged: assigned to self
    - Privileged: can assign to others OR leave unassigned (leave_unassigned=True)
    - Intercompany: privileged only, uses linked_client_ids and creates TaskClientLink rows
    """
    privileged = _is_privileged(current_user)

    is_intercompany = bool(getattr(task_in, "is_intercompany", False))
    linked_client_ids = list(dict.fromkeys((task_in.linked_client_ids or [])))  # unique, keep order

    if is_intercompany:
        if not privileged:
            raise HTTPException(status_code=403, detail="Only Admin/Owner can create intercompany tasks")
        if not linked_client_ids:
            raise HTTPException(status_code=422, detail="linked_client_ids is required for intercompany tasks")

        # ensure caller can access ALL linked clients (or you can loosen this later)
        for cid in linked_client_ids:
            assert_client_access(db, current_user, cid)

    assigned_user_id = current_user.id
    if privileged:
        if task_in.assigned_user_id is not None:
            assigned_user_id = task_in.assigned_user_id
        elif bool(getattr(task_in, "leave_unassigned", False)):
            assigned_user_id = None

    task_type = task_in.task_type or "ad_hoc"
    task = models.Task(
        title=task_in.title.strip(),
        description=task_in.description,
        status=task_in.status or "new",
        due_date=task_in.due_date,
        client_id=task_in.client_id,
        assigned_user_id=assigned_user_id,
        recurring_task_id=task_in.recurring_task_id,
        task_type=task_type,
        created_by_id=current_user.id,
        is_intercompany=is_intercompany,
    )
    db.add(task)
    db.flush()  # task.id available
    if is_intercompany:
        # anchor the task to the first client for convenience (client tab queries also join links)
        task.client_id = linked_client_ids[0]
        for cid in linked_client_ids:
            db.add(models.TaskClientLink(task_id=task.id, client_id=cid))

    db.commit()
    db.refresh(task)

    try:
        task.linked_client_ids = _task_linked_client_ids(db, task)  # type: ignore[attr-defined]
    except Exception:
        pass

    return task


@router.put("/{task_id}", response_model=schemas.TaskOut)
async def update_task(
    task_id: int,
    task_in: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _ensure_task_visible(db, current_user, task_id)

    privileged = _is_privileged(current_user)
    if not privileged and task.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this task")

    # privileged assignment
    if privileged and task_in.assigned_user_id is not None:
        task.assigned_user_id = task_in.assigned_user_id

    if task_in.title is not None:
        task.title = task_in.title.strip()
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.due_date is not None:
        task.due_date = task_in.due_date
    if task_in.client_id is not None:
        task.client_id = task_in.client_id
    if task_in.recurring_task_id is not None:
        task.recurring_task_id = task_in.recurring_task_id
    if task_in.task_type is not None:
        task.task_type = task_in.task_type
    if task_in.onboarding_phase is not None:
        task.onboarding_phase = task_in.onboarding_phase
    if task_in.template_task_id is not None:
        task.template_task_id = task_in.template_task_id

    status_changed_to_completed = (task_in.status is not None and task_in.status.lower() == "completed")
    if task_in.status is not None:
        # block completing intercompany task if not all linked clients completed
        if status_changed_to_completed and bool(getattr(task, "is_intercompany", False)):
            links = (
                db.query(models.TaskClientLink)
                .filter(models.TaskClientLink.task_id == task.id)
                .all()
            )
            if links and any(not l.is_completed for l in links):
                raise HTTPException(
                    status_code=409,
                    detail="Cannot complete intercompany task until all linked clients are checked off.",
                )
        task.status = task_in.status
    db.commit()
    db.refresh(task)

    if task.task_type == "onboarding" and task.client_id and status_changed_to_completed:
        release_onboarding_tasks_if_ready(
            db=db,
            client_id=task.client_id,
            created_by_user_id=current_user.id,
        )
        db.refresh(task)

    try:
        task.linked_client_ids = _task_linked_client_ids(db, task)  # type: ignore[attr-defined]
    except Exception:
        pass

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _ensure_task_visible(db, current_user, task_id)
    privileged = _is_privileged(current_user)

    if not privileged and task.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    db.delete(task)
    db.commit()
    return None


# --------- Dashboard endpoint ----------

@router.get("/my-dashboard", response_model=schemas.TaskDashboardResponse)
async def get_my_dashboard(
    assignee_user_id: Optional[int] = None,
    include_unassigned: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Dashboard filter behavior:
    - Bookkeeper/etc: can only view self
    - Manager: can view self + direct reports
    - Admin/Owner: can view anyone, OR view unassigned via include_unassigned=true
    """
    role = (current_user.role or "").strip().lower()
    is_privileged = role in ("owner", "admin")
    is_manager = role == "manager"

    if include_unassigned and not is_privileged:
        raise HTTPException(status_code=403, detail="Only Admin/Owner can view unassigned tasks")

    # Determine which user we're viewing
    target_user_id = assignee_user_id or current_user.id

    if not is_privileged:
        if is_manager:
            allowed_ids = (
                db.query(models.User.id)
                .filter(
                    (models.User.id == current_user.id)
                    | (models.User.manager_id == current_user.id)
                )
                .all()
            )
            allowed_ids = {row[0] for row in allowed_ids}
            if target_user_id not in allowed_ids:
                raise HTTPException(status_code=403, detail="Not allowed to view this user's dashboard")
        else:
            if target_user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Not allowed to view this user's dashboard")

    today = date.today()
    seven_days = today + timedelta(days=7)

    base_q = db.query(models.Task)

    # who are we viewing?
    if include_unassigned:
        base_q = base_q.filter(models.Task.assigned_user_id.is_(None))
    else:
        base_q = base_q.filter(models.Task.assigned_user_id == target_user_id)

    # never show blocked onboarding in dashboard
    base_q = base_q.filter(
        ~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked"))
    )
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

# --------- Intercompany linked clients ----------

@router.get("/{task_id}/linked-clients", response_model=List[schemas.TaskClientLinkOut])
async def list_task_linked_clients(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _ensure_task_visible(db, current_user, task_id)
    if not bool(getattr(task, "is_intercompany", False)):
        return []

    links = (
        db.query(models.TaskClientLink)
        .filter(models.TaskClientLink.task_id == task_id)
        .all()
    )

    # attach client names
    out: List[schemas.TaskClientLinkOut] = []
    for l in links:
        c = db.query(models.Client).filter(models.Client.id == l.client_id).first()
        out.append(
            schemas.TaskClientLinkOut(
                client_id=l.client_id,
                client_name=c.legal_name if c else None,
                is_completed=bool(l.is_completed),
                completed_at=l.completed_at,
                completed_by_id=l.completed_by_id,
            )
        )
    return out

@router.put("/{task_id}/linked-clients/{client_id}", response_model=schemas.TaskClientLinkOut)
async def set_task_linked_client_completion(
    task_id: int,
    client_id: int,
    body: schemas.TaskClientLinkUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _ensure_task_visible(db, current_user, task_id)
    if not bool(getattr(task, "is_intercompany", False)):
        raise HTTPException(status_code=409, detail="Not an intercompany task")

    # must have access to that client to check it off
    assert_client_access(db, current_user, client_id)

    link = (
        db.query(models.TaskClientLink)
        .filter(models.TaskClientLink.task_id == task_id, models.TaskClientLink.client_id == client_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Linked client not found on this task")

    if body.is_completed:
        link.is_completed = True
        link.completed_at = datetime.utcnow()
        link.completed_by_id = current_user.id
    else:
        link.is_completed = False
        link.completed_at = None
        link.completed_by_id = None

    db.commit()

    c = db.query(models.Client).filter(models.Client.id == client_id).first()
    return schemas.TaskClientLinkOut(
        client_id=client_id,
        client_name=c.legal_name if c else None,
        is_completed=bool(link.is_completed),
        completed_at=link.completed_at,
        completed_by_id=link.completed_by_id,
    )

# --------- Subtasks ----------

@router.get("/{task_id}/subtasks", response_model=List[schemas.TaskSubtaskOut])
async def list_subtasks(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(db, current_user, task_id)
    return (
        db.query(models.TaskSubtask)
        .filter(models.TaskSubtask.task_id == task_id)
        .order_by(models.TaskSubtask.sort_order, models.TaskSubtask.id)
        .all()
    )


@router.post("/{task_id}/subtasks", response_model=schemas.TaskSubtaskOut, status_code=status.HTTP_201_CREATED)
async def create_subtask(
    task_id: int,
    sub_in: schemas.TaskSubtaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(db, current_user, task_id)
    sub = models.TaskSubtask(task_id=task_id, title=sub_in.title.strip())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{task_id}/subtasks/{sub_id}", response_model=schemas.TaskSubtaskOut)
async def update_subtask(
    task_id: int,
    sub_id: int,
    sub_in: schemas.TaskSubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(db, current_user, task_id)
    sub = (
        db.query(models.TaskSubtask)
        .filter(models.TaskSubtask.id == sub_id, models.TaskSubtask.task_id == task_id)
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
    _ensure_task_visible(db, current_user, task_id)
    notes = (
        db.query(models.TaskNote)
        .filter(models.TaskNote.task_id == task_id)
        .order_by(models.TaskNote.created_at.desc())
        .all()
    )

    out = []
    for n in notes:
        if n.author and not getattr(n, "author_name", None):
            n.author_name = n.author.name or n.author.email  # type: ignore[attr-defined]
        out.append(n)
    return out
@router.post("/{task_id}/notes", response_model=schemas.TaskNoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    task_id: int,
    note_in: schemas.TaskNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_task_visible(db, current_user, task_id)
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


# --------- Client tasks tab endpoint ----------

@router.get("/client/{client_id}", response_model=List[schemas.TaskOut])
async def list_tasks_for_client(
    client_id: int,
    task_types: Optional[str] = None,  # comma-separated: "ad_hoc,project"
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # must be able to access the client
    assert_client_access(db, current_user, client_id)

    # include:
    # - tasks directly on the client_id
    # - tasks linked through TaskClientLink (intercompany)
    query = (
        db.query(models.Task)
        .outerjoin(models.TaskClientLink, models.TaskClientLink.task_id == models.Task.id)
        .filter(or_(models.Task.client_id == client_id, models.TaskClientLink.client_id == client_id))
        .distinct()
    )

    types = [t.strip() for t in (task_types or "").split(",") if t.strip()]
    if types:
        query = query.filter(models.Task.task_type.in_(types))
    else:
        query = query.filter(~models.Task.task_type.in_(["onboarding", "recurring"]))

    query = query.filter(~((models.Task.task_type == "onboarding") & (func.lower(models.Task.status) == "blocked")))

    if status and status != "all":
        query = query.filter(models.Task.status == status)

    if q:
        query = query.filter(models.Task.title.ilike(f"%{q}%"))

    tasks = query.order_by(models.Task.created_at.desc()).all()
    for t in tasks:
        try:
            t.linked_client_ids = _task_linked_client_ids(db, t)  # type: ignore[attr-defined]
        except Exception:
            pass
    return tasks