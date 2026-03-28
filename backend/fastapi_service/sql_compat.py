"""Cross-database SQL helpers (PostgreSQL + SQLite)."""

from datetime import date
from typing import Any

from sqlalchemy import Date, cast


def filter_on_calendar_day(column: Any, d: date):
    """
    Match rows where a timezone-aware or naive datetime column falls on calendar day ``d``.
    Avoids SQLite-only ``strftime`` so PostgreSQL works too.
    """
    return cast(column, Date) == d
