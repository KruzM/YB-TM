# app/recurring_utils.py
from datetime import date, timedelta


def last_day_of_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    next_month = date(year, month + 1, 1)
    return (next_month - timedelta(days=1)).day


def advance_next_run(schedule_type: str, current_next_run: date, *, day_of_month=None, weekday=None, week_of_month=None) -> date:
    """
    Given schedule and current next_run, compute the next occurrence.
    schedule_type: 'monthly', 'quarterly', 'annual'
    day_of_month: 1..28 typically
    weekday: 0=Mon..6=Sun
    week_of_month: 1..4 or -1 for last
    """
    if schedule_type == "monthly":
        months_to_add = 1
    elif schedule_type == "quarterly":
        months_to_add = 3
    elif schedule_type == "annual":
        months_to_add = 12
    else:
        months_to_add = 1

    current = current_next_run
    month = current.month - 1 + months_to_add
    year = current.year + month // 12
    month = month % 12 + 1

    # 1) Day-of-month rule
    if day_of_month:
        day = min(day_of_month, last_day_of_month(year, month))
        return date(year, month, day)

    # 2) Weekday-of-month rule: first Monday, last Friday, etc.
    if weekday is not None and week_of_month:
        # week_of_month: 1..4 or -1 for last
        if week_of_month > 0:
            first_of_month = date(year, month, 1)
            offset = (weekday - first_of_month.weekday()) % 7
            first_occurrence = first_of_month + timedelta(days=offset)
            return first_occurrence + timedelta(weeks=week_of_month - 1)
        else:  # last
            last_dom = last_day_of_month(year, month)
            last_date = date(year, month, last_dom)
            offset = (last_date.weekday() - weekday) % 7
            return last_date - timedelta(days=offset)

    # 3) Fallback: same day-of-month as current
    day = min(current.day, last_day_of_month(year, month))
    return date(year, month, day)
