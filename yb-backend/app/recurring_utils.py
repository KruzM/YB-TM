# app/recurring_utils.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional


def last_day_of_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    next_month = date(year, month + 1, 1)
    return (next_month - timedelta(days=1)).day


def _add_months(d: date, months: int) -> tuple[int, int]:
    """Return (year, month) after adding months to d's (year, month)."""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return y, m


def advance_next_run(
    schedule_type: str,
    current_next_run: date,
    *,
    day_of_month: Optional[int] = None,
    weekday: Optional[int] = None,        # 0=Mon..6=Sun
    week_of_month: Optional[int] = None,  # 1..4, or -1 for last
) -> date:
    """
    Compute the next run date after current_next_run.

    Rules:
      - schedule_type: 'monthly' | 'quarterly' | 'annual'
      - Either use day_of_month OR (weekday + week_of_month). If neither is provided,
        fallback to same day-of-month as current_next_run.
    """
    st = (schedule_type or "").strip().lower()
    if st == "monthly":
        months_to_add = 1
    elif st == "quarterly":
        months_to_add = 3
    elif st == "annual":
        months_to_add = 12
    else:
        months_to_add = 1

    year, month = _add_months(current_next_run, months_to_add)

    # 1) Day-of-month rule
    if day_of_month:
        dom = int(day_of_month)
        dom = max(1, min(dom, 31))
        day = min(dom, last_day_of_month(year, month))
        return date(year, month, day)

    # 2) Weekday-of-month rule: e.g. 2nd Tuesday, last Friday
    if weekday is not None and week_of_month:
        wd = int(weekday)
        wom = int(week_of_month)

        if wom > 0:
            first = date(year, month, 1)
            offset = (wd - first.weekday()) % 7
            first_occurrence = first + timedelta(days=offset)
            candidate = first_occurrence + timedelta(weeks=wom - 1)
            # Guard: if we somehow jumped to next month, clamp to last occurrence in month
            if candidate.month != month:
                last_dom = last_day_of_month(year, month)
                last_date = date(year, month, last_dom)
                back = (last_date.weekday() - wd) % 7
                return last_date - timedelta(days=back)
            return candidate
        else:
            # last occurrence
            last_dom = last_day_of_month(year, month)
            last_date = date(year, month, last_dom)
            back = (last_date.weekday() - wd) % 7
            return last_date - timedelta(days=back)

    # 3) Fallback: same day-of-month as current
    day = min(current_next_run.day, last_day_of_month(year, month))
    return date(year, month, day)
def next_run_from(
    schedule_type: str,
    from_date: date,
    *,
    day_of_month: Optional[int] = None,
    weekday: Optional[int] = None,
    week_of_month: Optional[int] = None,
) -> date:
    """
    Return the next run date ON or AFTER from_date, based on the rule.
    This is for computing the FIRST due date from a starting point.

    Then use advance_next_run() to move to the next cycle after that.
    """
    st = (schedule_type or "").strip().lower()
    if st == "monthly":
        step = 1
    elif st == "quarterly":
        step = 3
    elif st == "annual":
        step = 12
    else:
        step = 1

    def occurrence_in_month(y: int, m: int) -> date:
        # day-of-month
        if day_of_month:
            dom = max(1, min(int(day_of_month), 31))
            d = min(dom, last_day_of_month(y, m))
            return date(y, m, d)

        # weekday-of-month
        if weekday is not None and week_of_month:
            wd = int(weekday)
            wom = int(week_of_month)

            if wom > 0:
                first = date(y, m, 1)
                offset = (wd - first.weekday()) % 7
                first_occurrence = first + timedelta(days=offset)
                candidate = first_occurrence + timedelta(weeks=wom - 1)
                if candidate.month != m:
                    # clamp to last occurrence
                    last_dom = last_day_of_month(y, m)
                    last_date = date(y, m, last_dom)
                    back = (last_date.weekday() - wd) % 7
                    return last_date - timedelta(days=back)
                return candidate
            else:
                # last occurrence
                last_dom = last_day_of_month(y, m)
                last_date = date(y, m, last_dom)
                back = (last_date.weekday() - wd) % 7
                return last_date - timedelta(days=back)

        # fallback = same day-of-month as from_date
        d = min(from_date.day, last_day_of_month(y, m))
        return date(y, m, d)
    # try in the current month first
    candidate = occurrence_in_month(from_date.year, from_date.month)
    if candidate >= from_date:
        return candidate

    # otherwise jump ahead by the schedule step until we're >= from_date
    y, m = _add_months(from_date, step)
    while True:
        candidate = occurrence_in_month(y, m)
        if candidate >= from_date:
            return candidate
        y, m = _add_months(date(y, m, 1), step)
