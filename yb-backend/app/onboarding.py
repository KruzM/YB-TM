from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Client, Task, OnboardingTemplateTask


def _pick_assigned_user_id(client: Client, default_assigned_role: Optional[str]) -> Optional[int]:
    """
    Map 'bookkeeper' / 'manager' / 'admin' to an actual user_id from the client record.
    Adjust logic as needed for your firm.
    """
    if not default_assigned_role:
        return None

    role = default_assigned_role.lower()

    if role == "bookkeeper":
        return client.bookkeeper_id
    if role == "manager":
        return client.manager_id
    if role == "admin":
        # simple fallback: manager > bookkeeper
        return client.manager_id or client.bookkeeper_id

    return None


def create_onboarding_tasks_for_client(
    db: Session,
    client: Client,
    created_by_user_id: Optional[int] = None,
) -> List[Task]:
    """
    Generate onboarding tasks for a client from active onboarding templates.

    Idempotent: if this client already has onboarding tasks, it does nothing.
    """

    # Prevent duplicate creation if somehow called twice
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

    templates: List[OnboardingTemplateTask] = (
        db.query(OnboardingTemplateTask)
        .filter(OnboardingTemplateTask.is_active == True)
        .order_by(
            OnboardingTemplateTask.order_index.asc(),
            OnboardingTemplateTask.id.asc(),
        )
        .all()
    )

    base_date: datetime = getattr(client, "created_at", None) or datetime.utcnow()

    created_tasks: List[Task] = []

    for tmpl in templates:
        assigned_user_id = _pick_assigned_user_id(client, tmpl.default_assigned_role)

        if tmpl.default_due_offset_days is not None:
            due_date = base_date + timedelta(days=tmpl.default_due_offset_days)
        else:
            due_date = None

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

    db.commit()
    for t in created_tasks:
        db.refresh(t)

    return created_tasks
