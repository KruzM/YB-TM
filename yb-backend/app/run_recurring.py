# app/run_recurring.py
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from .database import SessionLocal
from . import models
from .recurring_utils import advance_next_run


def _ensure_task_for_rule_and_date(db, rule: models.RecurringTask, due: date) -> bool:
    due_dt = datetime.combine(due, datetime.min.time())

    existing = (
        db.query(models.Task)
        .filter(
            models.Task.recurring_task_id == rule.id,
            models.Task.task_type == "recurring",
            models.Task.due_date == due_dt,
        )
        .first()
    )
    if existing:
        return False

    task = models.Task(
        title=rule.name,
        description=rule.description or "",
        status=rule.default_status or "new",
        due_date=due_dt,
        assigned_user_id=rule.assigned_user_id,
        client_id=rule.client_id,
        recurring_task_id=rule.id,
        task_type="recurring",
    )
    db.add(task)
    return True

def run_once(today: Optional[date] = None) -> dict:
    today = today or date.today()
    db = SessionLocal()
    created = 0
    advanced = 0
    skipped_infinite = 0

    try:
        rules = (
            db.query(models.RecurringTask)
            .filter(models.RecurringTask.active == True)  # noqa: E712
            .all()
        )

        for rule in rules:
            if not rule.next_run:
                continue

            loops = 0
            while rule.next_run and rule.next_run <= today:
                loops += 1
                if loops > 36:  # safety for misconfigured rules
                    skipped_infinite += 1
                    break

                due = rule.next_run
                if _ensure_task_for_rule_and_date(db, rule, due):
                    created += 1

                rule.next_run = advance_next_run(
                    rule.schedule_type,
                    due,
                    day_of_month=rule.day_of_month,
                    weekday=rule.weekday,
                    week_of_month=rule.week_of_month,
                )
                advanced += 1

        db.commit()
        return {
            "created": created,
            "advanced": advanced,
            "skipped_infinite": skipped_infinite,
            "today": str(today),
        }
    finally:
        db.close()


def main():
    result = run_once()
    print(
        f"[run_recurring] {result['today']} created={result['created']} advanced={result['advanced']} skipped={result['skipped_infinite']}"
    )


if __name__ == "__main__":
    main()
