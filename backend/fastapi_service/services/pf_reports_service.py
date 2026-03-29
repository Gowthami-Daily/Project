from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import finance_expense_to_out, finance_income_to_out


def _ensure_finance_account(db: Session, profile_id: int, account_id: int | None):
    if account_id is None:
        return None
    acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
    if acc is None:
        raise ValueError('Account not found')
    return acc


def _current_cash(db: Session, profile_id: int, account_id: int | None) -> float:
    if account_id is not None:
        acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        if acc is None:
            raise ValueError('Account not found')
        return float(acc.balance)
    return pf_finance_repo.sum_account_balances(db, profile_id)


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


def expense_analytics(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> dict:
    """Category, person (paid_by), account, EMI block, dairy block for the date window."""
    by_cat = pf_finance_repo.expense_by_category(db, profile_id, start, end)
    by_person = pf_finance_repo.expense_by_paid_by(db, profile_id, start, end)
    by_acc = pf_finance_repo.expense_by_account_breakdown(db, profile_id, start, end)
    emi = pf_finance_repo.sum_expense_emi_categories(db, profile_id, start, end)
    dairy = pf_finance_repo.sum_expense_categories_exact(
        db, profile_id, start, end, ['Dairy Farm Expenses', 'Feed']
    )
    return {
        'start': start.isoformat() if start else None,
        'end': end.isoformat() if end else None,
        'by_category': [{'category': c, 'amount': a} for c, a in by_cat],
        'by_person': [{'person': p, 'amount': a} for p, a in by_person],
        'by_account': [
            {'account_id': i, 'account_name': n, 'amount': a} for i, n, a in by_acc
        ],
        'emi_expenses_total': emi,
        'dairy_expenses_total': dairy,
    }


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


def month_ledger(
    db: Session,
    profile_id: int,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict:
    """
    Income and expense rows for one calendar month (up to 5000 each), for daily statement views.
    """
    if month < 1 or month > 12:
        raise ValueError('month must be 1–12')
    _ensure_finance_account(db, profile_id, account_id)
    start = date(year, month, 1)
    last = monthrange(year, month)[1]
    end = date(year, month, last)
    inc = pf_finance_repo.list_income(db, profile_id, 0, 5000, start, end, account_id)
    exp = pf_finance_repo.list_expenses(db, profile_id, 0, 5000, start, end, account_id)
    return {
        'year': year,
        'month': month,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'income': [finance_income_to_out(r).model_dump(mode='json') for r in inc],
        'expenses': [finance_expense_to_out(r).model_dump(mode='json') for r in exp],
    }


def daily_ledger(
    db: Session,
    profile_id: int,
    from_date: date,
    to_date: date,
    account_id: int | None = None,
) -> dict:
    """
    Income and expense rows between ``from_date`` and ``to_date`` (inclusive), up to 5000 each.
    """
    if from_date > to_date:
        raise ValueError('from_date must be on or before to_date')
    span = (to_date - from_date).days + 1
    if span > 400:
        raise ValueError('Date range cannot exceed 400 days')
    _ensure_finance_account(db, profile_id, account_id)
    inc = pf_finance_repo.list_income(db, profile_id, 0, 5000, from_date, to_date, account_id)
    exp = pf_finance_repo.list_expenses(db, profile_id, 0, 5000, from_date, to_date, account_id)
    return {
        'from_date': from_date.isoformat(),
        'to_date': to_date.isoformat(),
        'income': [finance_income_to_out(r).model_dump(mode='json') for r in inc],
        'expenses': [finance_expense_to_out(r).model_dump(mode='json') for r in exp],
    }


def monthly_financial_tables(
    db: Session,
    profile_id: int,
    year: int,
    account_id: int | None = None,
) -> dict:
    """
    Monthly rows for income statement, cash flow (operating), and a simplified balance sheet.

    **Cash** at month-end is *estimated* by back-solving Jan-1 cash from current balances and
    YTD ledger activity, then walking forward month by month. Manual balance edits break this.

    Investments, fixed assets, liabilities, and loans use **current** profile snapshots on every
    row (we do not store month-end history for those).
    """
    _ensure_finance_account(db, profile_id, account_id)
    today = date.today()
    if year > today.year:
        return {
            'year': year,
            'opening_cash_estimate': 0.0,
            'rows': [],
            'note': 'No rows — selected year is in the future.',
        }

    ytd_start = date(year, 1, 1)
    ytd_end = min(today, date(year, 12, 31))
    current_cash = _current_cash(db, profile_id, account_id)
    ytd_income = pf_finance_repo.sum_income(db, profile_id, ytd_start, ytd_end, account_id)
    ytd_expense = pf_finance_repo.sum_expense(db, profile_id, ytd_start, ytd_end, account_id)
    ytd_net = ytd_income - ytd_expense
    # Implied Jan-1 cash if ledger + balances agreed: current = opening + ytd_net
    raw_opening = current_cash - ytd_net
    # When raw_opening < 0, books disagree (e.g. income logged but balances not bumped, wrong filter).
    # Walking from raw_opening shows misleading negative months — use ₹0 opening for the timeline instead.
    use_zero_opening = raw_opening < -0.01
    opening_cash = 0.0 if use_zero_opening else raw_opening
    reconciliation_warning: str | None = None
    if use_zero_opening:
        reconciliation_warning = (
            'Stored cash in account balance(s) is less than YTD income minus expenses would imply, '
            'so a straight “back-solve” opening would be negative. The table uses a ₹0 opening on 1 Jan '
            'and adds each month’s income and expenses so you see a normal cumulative cash path. '
            'Align Accounts balances with your transactions (or pick the correct bank filter). '
            f'Current balance(s) in scope: ₹{current_cash:,.2f}; YTD net (ledger): ₹{ytd_net:,.2f}.'
        )

    investments = pf_finance_repo.sum_investments_current(db, profile_id)
    fixed_assets = pf_finance_repo.sum_assets(db, profile_id)
    liabilities = pf_finance_repo.sum_liabilities(db, profile_id)
    loans_out = pf_finance_repo.sum_loan_outstanding(db, profile_id)

    month_names = (
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    )

    rows: list[dict] = []
    closing_cash = opening_cash

    for month in range(1, 13):
        if year > today.year:
            break
        if year == today.year and month > today.month:
            break

        ms = date(year, month, 1)
        me_last = date(year, month, monthrange(year, month)[1])
        if year < today.year or (year == today.year and month < today.month):
            me = me_last
        else:
            me = today

        inc = pf_finance_repo.sum_income(db, profile_id, ms, me, account_id)
        exp = pf_finance_repo.sum_expense(db, profile_id, ms, me, account_id)
        net = inc - exp
        closing_cash += net

        # Loan outstanding here is receivable (money owed to you) — part of assets, not a liability.
        total_assets = closing_cash + investments + fixed_assets + loans_out
        net_worth = total_assets - liabilities

        key = f'{year}-{month:02d}'
        rows.append(
            {
                'month_key': key,
                'month_index': month,
                'label': f'{month_names[month - 1]} {year}',
                'period_end': me.isoformat(),
                'income_statement': {
                    'income': inc,
                    'expense': exp,
                    'net_income': net,
                },
                'cash_flow': {
                    'cash_in_operating': inc,
                    'cash_out_operating': exp,
                    'net_operating_cash_flow': net,
                    'closing_cash_estimate': closing_cash,
                },
                'balance_sheet': {
                    'cash_estimate': closing_cash,
                    'investments': investments,
                    'fixed_assets': fixed_assets,
                    'total_assets': total_assets,
                    'liabilities': liabilities,
                    'loans_outstanding': loans_out,
                    'net_worth': net_worth,
                },
            }
        )

    return {
        'year': year,
        'account_id': account_id,
        'opening_cash_estimate': opening_cash,
        'implied_opening_raw': raw_opening,
        'cash_timeline_mode': 'incremental_from_zero' if use_zero_opening else 'reconciled_opening',
        'reconciliation_warning': reconciliation_warning,
        'current_cash_reported': current_cash,
        'ytd_net_ledger': ytd_net,
        'methodology': (
            'Cash is reconstructed from current account balance(s) minus YTD net ledger activity, '
            'then rolled forward by month. If that implies a negative 1 Jan balance, the timeline '
            'switches to a ₹0 opening so months are not shown negative. Investments, assets, liabilities, '
            'and loans repeat current totals (no historical snapshots). Manual balance edits can skew cash.'
        ),
        'rows': rows,
    }
