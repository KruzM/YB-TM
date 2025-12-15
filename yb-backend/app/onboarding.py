# app/onboarding.py
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Client, Task, OnboardingTemplateTask, User



def _pick_assigned_user_id(
    db: Session,
    client: Client,
    template: OnboardingTemplateTask,
    created_by_user_id: Optional[int] = None,
) -> Optional[int]:
    from .models import User  # or wherever your User model lives

    def is_admin(user_id: int) -> bool:
        user = db.query(User).filter(User.id == user_id).first()
        return bool(user and user.role == "admin" and user.is_active)

    role = template.default_assigned_role
    phase = (template.phase or "").lower()

    admin_phases = {"admin setup", "contracts", "billing", "engagement", "payroll provider"}
    bookkeeper_phases = {
        "qbo setup",
        "bank feeds",
        "reconcile",
        "chart of accounts",
        "reporting",
        "cleanup",
    }

    # 1) Explicit role from template
    if role == "bookkeeper":
        return client.bookkeeper_id or client.manager_id or created_by_user_id
    if role == "manager":
        return client.manager_id or client.bookkeeper_id or created_by_user_id
    if role == "admin":
        if created_by_user_id and is_admin(created_by_user_id):
            return created_by_user_id
        admin = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True)
            .order_by(User.id)
            .first()
        )
        return admin.id if admin else created_by_user_id

    # 2) Role is None ? fall back to phase-based guesses
    if phase in admin_phases:
        return client.manager_id or created_by_user_id
    if phase in bookkeeper_phases:
        return client.bookkeeper_id or client.manager_id or created_by_user_id

    # 3) Last resort
    return client.bookkeeper_id or client.manager_id or created_by_user_id



def create_onboarding_tasks_for_client(
    db: Session,
    client: Client,
    created_by_user_id: Optional[int] = None,
) -> List[Task]:
    """
    Generate onboarding tasks for a client from active onboarding templates.

    Idempotent: if this client already has onboarding tasks, it does nothing.
    Returns the list of Task objects that were created (uncommitted).
    """

    # Don't duplicate if they already have onboarding tasks
    existing_count = (
        db.query(Task)
        .filter(
            Task.client_id == client.id,
            Task.task_type == "onboarding",
        )
        .count()
    )
    if existing_count > 0:
        return []

    # Pull active templates
    templates: List[OnboardingTemplateTask] = (
        db.query(OnboardingTemplateTask)
        .filter(OnboardingTemplateTask.is_active == True)
        .order_by(
            OnboardingTemplateTask.order_index.asc(),
            OnboardingTemplateTask.id.asc(),
        )
        .all()
    )

    if not templates:
        # Nothing to create
        return []

    # Use client.created_at as the base date when possible
    base_date: datetime = getattr(client, "created_at", None) or datetime.utcnow()

    created_tasks: List[Task] = []

    for tmpl in templates:
        # Decide who gets this task
        assigned_user_id = _pick_assigned_user_id(
            db=db,
            client=client,
            default_assigned_role=tmpl.default_assigned_role,
            created_by_user_id=created_by_user_id,
        )

        # Compute due date
        if tmpl.default_due_offset_days is not None:
            due_date = base_date + timedelta(days=tmpl.default_due_offset_days)
        else:
            due_date = None

        # Build the Task
        task = Task(
            title=tmpl.name,
            description=tmpl.description,
            status="new",
            due_date=due_date,
            client_id=client.id,
            assigned_user_id=assigned_user_id,
            recurring_task_id=None,
            task_type="onboarding",
            onboarding_phase=tmpl.phase,
            template_task_id=tmpl.id,
            created_by_id=created_by_user_id,
        )

        db.add(task)
        created_tasks.append(task)

    # Caller (convert_intake_to_client or backfill script) is responsible
    # for db.commit()
    return created_tasks