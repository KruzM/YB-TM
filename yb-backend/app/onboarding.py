from datetime import datetime, timedelta
from typing import List, Optional, Set

from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from .models import Client, Task, OnboardingTemplateTask, User


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


ADMIN_PHASES = {
    "admin setup",
    "contracts",
    "billing",
    "engagement",
    "payroll provider",
}

BOOKKEEPER_PHASES = {
    "qbo setup",
    "bank feeds",
    "reconcile",
    "chart of accounts",
    "reporting",
    "cleanup",
}


def _is_admin_template(tmpl: OnboardingTemplateTask) -> bool:
    role = _norm(tmpl.default_assigned_role)
    phase = _norm(tmpl.phase)
    return role == "admin" or phase in ADMIN_PHASES


def _pick_assigned_user_id(
    db: Session,
    client: Client,
    template: OnboardingTemplateTask,
    created_by_user_id: Optional[int] = None,
) -> Optional[int]:
    """
    Assignment rules:
    - admin tasks -> admin user
    - manager tasks -> client.manager_id (or None if not set)
    - bookkeeper tasks -> client.bookkeeper_id (or None if not set)
    """
    role = _norm(template.default_assigned_role)
    phase = _norm(template.phase)

    def is_admin(user_id: int) -> bool:
        u = db.query(User).filter(User.id == user_id).first()
        return bool(u and _norm(u.role) == "admin" and u.is_active)

    # Explicit template role
    if role == "bookkeeper":
        return client.bookkeeper_id
    if role == "manager":
        return client.manager_id
    if role == "admin":
        # Prefer the creator if they're an admin
        if created_by_user_id and is_admin(created_by_user_id):
            return created_by_user_id

        # Otherwise pick the first active admin
        admins = (
            db.query(User)
            .filter(User.is_active == True)
            .order_by(User.id.asc())
            .all()
        )
        admin_user = next((u for u in admins if _norm(u.role) == "admin"), None)
        return admin_user.id if admin_user else created_by_user_id
    # Phase-based fallback (if role wasn't set)
    if phase in ADMIN_PHASES:
        if created_by_user_id and is_admin(created_by_user_id):
            return created_by_user_id
        admins = (
            db.query(User)
            .filter(User.is_active == True)
            .order_by(User.id.asc())
            .all()
        )
        admin_user = next((u for u in admins if _norm(u.role) == "admin"), None)
        return admin_user.id if admin_user else created_by_user_id

    if phase in BOOKKEEPER_PHASES:
        return client.bookkeeper_id

    # Unknown phase/role -> leave unassigned
    return None


def create_onboarding_tasks_for_client(
    db: Session,
    client: Client,
    created_by_user_id: Optional[int] = None,
) -> List[Task]:
    """
    Create onboarding tasks for any missing templates (safe to run multiple times).
    Returns created Task objects (uncommitted).
    """

    templates: List[OnboardingTemplateTask] = (
        db.query(OnboardingTemplateTask)
        .filter(OnboardingTemplateTask.is_active == True)
        .order_by(OnboardingTemplateTask.order_index.asc(), OnboardingTemplateTask.id.asc())
        .all()
    )
    if not templates:
        return []

    # ? Better idempotency: only create missing template_task_id rows
    existing_template_ids: Set[int] = set(
        tid for (tid,) in (
            db.query(Task.template_task_id)
            .filter(
                Task.client_id == client.id,
                Task.task_type == "onboarding",
                Task.template_task_id.isnot(None),
            )
            .all()
        )
        if tid is not None
    )

    base_date: datetime = getattr(client, "created_at", None) or datetime.utcnow()
    created_tasks: List[Task] = []

    for tmpl in templates:
        if tmpl.id in existing_template_ids:
            continue

        is_admin_task = _is_admin_template(tmpl)

        # admin tasks start active; everything else starts blocked
        status = "new" if is_admin_task else "blocked"

        # IMPORTANT:
        # If you want Assigned names to show even while blocked, keep this assignment.
        # If you do NOT want blocked tasks to appear in user dashboards, we'll filter them out there (see section 3).
        assigned_user_id = _pick_assigned_user_id(
            db=db,
            client=client,
            template=tmpl,
            created_by_user_id=created_by_user_id,
        )

        due_date = (
            base_date + timedelta(days=tmpl.default_due_offset_days)
            if tmpl.default_due_offset_days is not None
            else None
        )

        new_task = Task(
            title=tmpl.name,
            description=tmpl.description,
            status=status,
            due_date=due_date,
            client_id=client.id,
            assigned_user_id=assigned_user_id,
            recurring_task_id=None,
            task_type="onboarding",
            onboarding_phase=tmpl.phase,
            template_task_id=tmpl.id,
            created_by_id=created_by_user_id,
        )

        db.add(new_task)
        created_tasks.append(new_task)

    db.flush()  # caller can commit; this makes rows real in the current transaction
    return created_tasks

def release_onboarding_tasks_if_ready(
    db: Session,
    client_id: int,
    created_by_user_id: Optional[int] = None,
) -> int:
    """
    If ALL admin onboarding tasks for this client are completed,
    release blocked onboarding tasks:
      - status: 'blocked' -> 'new'
      - assigned_user_id set based on template role + client staffing
    Returns number of tasks released.
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        return 0

    admin_phases_lower = list(ADMIN_PHASES)

    admin_tasks_q = (
        db.query(Task)
        .join(OnboardingTemplateTask, Task.template_task_id == OnboardingTemplateTask.id)
        .filter(
            Task.client_id == client_id,
            Task.task_type == "onboarding",
            or_(
                func.lower(OnboardingTemplateTask.default_assigned_role) == "admin",
                func.lower(OnboardingTemplateTask.phase).in_(admin_phases_lower),
            ),
        )
    )

    admin_total = admin_tasks_q.count()
    if admin_total > 0:
        admin_incomplete = (
            admin_tasks_q
            .filter(func.lower(Task.status) != "completed")
            .count()
        )
        if admin_incomplete > 0:
            return 0

    # Admin is done (or there were no admin tasks) -> release blocked tasks
    blocked_tasks = (
        db.query(Task)
        .filter(
            Task.client_id == client_id,
            Task.task_type == "onboarding",
            func.lower(Task.status) == "blocked",
        )
        .order_by(Task.id.asc())
        .all()
    )
    released = 0
    for t in blocked_tasks:
        tmpl = (
            db.query(OnboardingTemplateTask)
            .filter(OnboardingTemplateTask.id == t.template_task_id)
            .first()
            if t.template_task_id
            else None
        )
        if not tmpl:
            continue

        # only compute assignment if missing
        if not t.assigned_user_id:
            assigned = _pick_assigned_user_id(
                db=db,
                client=client,
                template=tmpl,
                created_by_user_id=created_by_user_id,
            )
            if not assigned:
                continue
            t.assigned_user_id = assigned

        t.status = "new"
        released += 1



    if released > 0:
        db.commit()

    return released