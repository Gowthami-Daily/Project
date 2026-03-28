from datetime import date

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo


def profit_loss(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> dict:
    inc = pf_finance_repo.sum_income(db, profile_id, start, end)
    exp = pf_finance_repo.sum_expense(db, profile_id, start, end)
    return {
        'income': inc,
        'expense': exp,
        'net': inc - exp,
        'start': start.isoformat() if start else None,
        'end': end.isoformat() if end else None,
    }


def cashflow_summary(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> dict:
    """Simple operating view: income minus expense (same window as P&L)."""
    return profit_loss(db, profile_id, start, end)


def expense_report(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> list[dict]:
    rows = pf_finance_repo.expense_by_category(db, profile_id, start, end)
    return [{'category': c, 'amount': a} for c, a in rows]


def income_report(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> dict:
    total = pf_finance_repo.sum_income(db, profile_id, start, end)
    return {'total_income': total, 'start': start.isoformat() if start else None, 'end': end.isoformat() if end else None}


def investment_report(db: Session, profile_id: int) -> dict:
    return {
        'total_market_value': pf_finance_repo.sum_investments_current(db, profile_id),
    }


def loan_report(db: Session, profile_id: int) -> dict:
    loans = pf_finance_repo.list_loans(db, profile_id)
    return {
        'loan_count': len(loans),
        'outstanding_approx': pf_finance_repo.sum_loan_outstanding(db, profile_id),
        'loans': [
            {
                'id': ln.id,
                'borrower_name': ln.borrower_name,
                'loan_amount': float(ln.loan_amount),
                'status': ln.status,
            }
            for ln in loans
        ],
    }
