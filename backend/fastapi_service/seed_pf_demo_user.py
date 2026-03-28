"""Demo login for personal finance UI (local dev only — idempotent)."""

from datetime import date

from sqlalchemy.orm import Session

from fastapi_service.core.password import hash_password
from fastapi_service.models import User
from fastapi_service.models_extended import FinanceAccount, FinanceExpense, FinanceIncome
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.repositories import profile_repo
from fastapi_service.repositories import user_repo
from fastapi_service.services import auth_service

# Exposed for docs / frontend (dev only).
# Use a domain Pydantic ``EmailStr`` accepts (``.local`` is rejected).
PF_DEMO_EMAIL = 'finance.demo@example.com'
PF_DEMO_PASSWORD = 'FinanceDemo123!'


def _month_on_or_before(today: date, months_back: int) -> date:
    y, m = today.year, today.month - months_back
    while m <= 0:
        m += 12
        y -= 1
    d = min(today.day, 28)
    return date(y, m, d)


def _seed_demo_transactions(db: Session, user_id: int) -> None:
    pid = profile_repo.first_profile_id_for_user(db, user_id)
    if pid is None:
        return
    if pf_finance_repo.list_income(db, pid, 0, 1, None, None):
        return

    acc = FinanceAccount(
        profile_id=pid,
        account_name='Demo Savings',
        account_type='bank',
        balance=45000.0,
    )
    acc = pf_finance_repo.create_account(db, acc)
    aid = acc.id
    today = date.today()

    incomes = [
        (0, 85000.0, 'salary', 'recurring', 'Salary'),
        (1, 82000.0, 'salary', 'recurring', 'Salary'),
        (2, 80000.0, 'salary', 'recurring', 'Salary'),
        (1, 15000.0, 'freelance', 'other', 'Side project'),
        (0, 11000.0, 'freelance', 'other', 'Consulting'),
    ]
    for mb, amt, cat, itype, desc in incomes:
        pf_finance_repo.create_income(
            db,
            FinanceIncome(
                profile_id=pid,
                account_id=aid,
                amount=amt,
                category=cat,
                income_type=itype,
                entry_date=_month_on_or_before(today, mb),
                description=desc,
            ),
        )

    expenses = [
        (0, 18000.0, 'housing', 'Rent'),
        (1, 17500.0, 'housing', 'Rent'),
        (2, 17500.0, 'housing', 'Rent'),
        (0, 9200.0, 'food', 'Groceries'),
        (1, 8800.0, 'food', 'Groceries'),
        (0, 3400.0, 'utilities', 'Utilities'),
        (1, 3100.0, 'utilities', 'Utilities'),
        (0, 12000.0, 'investments', 'SIP transfer'),
    ]
    for mb, amt, cat, desc in expenses:
        pf_finance_repo.create_expense(
            db,
            FinanceExpense(
                profile_id=pid,
                account_id=aid,
                amount=amt,
                category=cat,
                entry_date=_month_on_or_before(today, mb),
                description=desc,
            ),
        )


def seed_pf_demo_user(db: Session) -> None:
    existing = user_repo.get_by_email(db, PF_DEMO_EMAIL)
    if existing is not None:
        _seed_demo_transactions(db, existing.id)
        return

    user = User(
        name='Finance Demo',
        email=PF_DEMO_EMAIL,
        password_hash=hash_password(PF_DEMO_PASSWORD),
        role='USER',
        is_active=True,
    )
    user = user_repo.create(db, user=user)
    auth_service.bootstrap_new_user(db, user)
    _seed_demo_transactions(db, user.id)
