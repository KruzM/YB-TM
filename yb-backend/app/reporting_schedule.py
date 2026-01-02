from __future__ import annotations

from datetime import date
from typing import Optional

from .recurring_utils import last_day_of_month, next_run_from


MONTHLY_TIER_TO_DOM = {
    "5th": 5,
    "10th": 10,
    "15th": 15,
}


def next_monthly_close_due(from_date: date, monthly_close_tier: str) -> date:
    dom = MONTHLY_TIER_TO_DOM.get((monthly_close_tier or "").strip())
    if not dom:
        raise ValueError(f"Unknown monthly_close_tier: {monthly_close_tier}")
    return next_run_from("monthly", from_date, day_of_month=dom)


def next_quarterly_due(from_date: date) -> date:
    """
    Due: last day of the month AFTER quarter end.
    Quarter ends: Mar/Jun/Sep/Dec
    Due months:   Apr/Jul/Oct/Jan (last day)
    """
    y = from_date.year

    candidates = []
    for year in (y, y + 1):
        for month in (1, 4, 7, 10):  # Jan/Apr/Jul/Oct = month after quarter end
            dom = last_day_of_month(year, month)
            candidates.append(date(year, month, dom))

    return min(d for d in candidates if d >= from_date)


def next_annual_due(from_date: date) -> date:
    """Due Feb 15 each year."""
    y = from_date.year
    candidate = date(y, 2, 15)
    if candidate >= from_date:
        return candidate
    return date(y + 1, 2, 15)
