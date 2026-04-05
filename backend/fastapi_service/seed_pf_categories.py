"""Seed PF master expense/income categories (idempotent)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import PfExpenseCategory, PfIncomeCategory

EXPENSE_CATEGORY_SEED: list[tuple[str, str, str]] = [
    ('Food & Groceries', 'cart', 'green'),
    ('Rent / Housing', 'home', 'blue'),
    ('Electricity', 'bolt', 'yellow'),
    ('Water', 'droplet', 'blue'),
    ('Internet', 'wifi', 'purple'),
    ('Mobile', 'phone', 'indigo'),
    ('Transportation / Fuel', 'car', 'orange'),
    ('Vehicle Maintenance', 'wrench-screwdriver', 'gray'),
    ('EMI – Loans', 'banknotes', 'red'),
    ('EMI – Credit Card', 'credit-card', 'pink'),
    ('Insurance', 'shield', 'teal'),
    ('Medical / Doctor', 'heart', 'red'),
    ('Dairy Farm Expenses', 'building-storefront', 'green'),
    ('Feed', 'cube', 'yellow'),
    ('Salary / Wages', 'users', 'blue'),
    ('Investments', 'arrow-trending-up', 'green'),
    ('Gold Purchase', 'circle-stack', 'yellow'),
    ('Shopping', 'shopping-bag', 'pink'),
    ('Entertainment', 'film', 'purple'),
    ('Travel', 'paper-airplane', 'blue'),
    ('Education', 'academic-cap', 'indigo'),
    ('Family Expenses', 'home-modern', 'orange'),
    ('Miscellaneous', 'ellipsis-horizontal', 'gray'),
]

INCOME_CATEGORY_SEED: list[tuple[str, str, str]] = [
    ('Salary', 'briefcase', 'emerald'),
    ('Business Income', 'building-office', 'blue'),
    ('Milk Income (Dairy)', 'beaker', 'green'),
    ('Rent Income', 'home', 'teal'),
    ('Interest', 'percent-badge', 'amber'),
    ('Dividends', 'chart-bar', 'violet'),
    ('Freelancing', 'computer-desktop', 'sky'),
    ('Bonus', 'gift', 'rose'),
    ('Agricultural / Farm Sales', 'truck', 'lime'),
    ('Capital Gains', 'arrow-trending-up', 'indigo'),
    ('Refund / Cashback', 'arrow-uturn-left', 'slate'),
    ('Other Income', 'banknotes', 'gray'),
]


def ensure_pf_chit_categories(db: Session) -> None:
    """Idempotent: PF ledger category strings used by chit fund flows."""
    extra_exp: list[tuple[str, str, str]] = [
        ('Chit Fund Contribution', 'banknotes', 'amber'),
        ('Chit Fund Discount (Loss)', 'arrow-trending-down', 'rose'),
        ('Chit Foreman Commission', 'receipt-percent', 'orange'),
    ]
    for name, icon, color in extra_exp:
        exists = db.scalar(select(PfExpenseCategory.id).where(PfExpenseCategory.name == name).limit(1))
        if exists is None:
            db.add(PfExpenseCategory(name=name, icon=icon, color=color))
    inc_name = 'Chit Dividend'
    exists_i = db.scalar(select(PfIncomeCategory.id).where(PfIncomeCategory.name == inc_name).limit(1))
    if exists_i is None:
        db.add(PfIncomeCategory(name=inc_name, icon='gift', color='emerald'))
    db.commit()


def seed_pf_finance_categories(db: Session) -> None:
    exp_count = db.scalar(select(func.count()).select_from(PfExpenseCategory)) or 0
    if exp_count == 0:
        for name, icon, color in EXPENSE_CATEGORY_SEED:
            db.add(PfExpenseCategory(name=name, icon=icon, color=color))
        db.commit()
    inc_count = db.scalar(select(func.count()).select_from(PfIncomeCategory)) or 0
    if inc_count == 0:
        for name, icon, color in INCOME_CATEGORY_SEED:
            db.add(PfIncomeCategory(name=name, icon=icon, color=color))
        db.commit()
