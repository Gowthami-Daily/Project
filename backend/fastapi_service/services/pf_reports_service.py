from calendar import monthrange
from datetime import date, timedelta

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
        'total_invested': pf_finance_repo.sum_investments_invested(db, profile_id),
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


def _prior_period(start: date, end: date) -> tuple[date, date]:
    span = (end - start).days + 1
    p_end = start - timedelta(days=1)
    p_start = p_end - timedelta(days=span - 1)
    return p_start, p_end


def _trend_block(current: float, prior: float) -> dict:
    cur = round(float(current), 2)
    prv = round(float(prior), 2)
    if prv <= 0.01:
        pct = None if cur <= 0.01 else None
        direction = 'flat' if cur <= 0.01 else 'up'
        return {'current': cur, 'prior': prv, 'trend_pct': pct, 'direction': direction}
    delta_pct = (cur - prv) / prv * 100.0
    direction = 'flat'
    if delta_pct > 0.5:
        direction = 'up'
    elif delta_pct < -0.5:
        direction = 'down'
    return {'current': cur, 'prior': prv, 'trend_pct': round(delta_pct, 2), 'direction': direction}


def _pct_share(part: float, whole: float) -> float:
    if whole <= 0.01:
        return 0.0
    return round(100.0 * float(part) / float(whole), 2)


def _month_slices(start: date, end: date):
    y, m = start.year, start.month
    while True:
        ms = date(y, m, 1)
        last_d = monthrange(y, m)[1]
        me_month = date(y, m, last_d)
        chunk_start = max(start, ms)
        chunk_end = min(end, me_month)
        if chunk_start <= chunk_end:
            key = f'{y}-{m:02d}'
            label = ms.strftime('%b %Y')
            yield key, label, chunk_start, chunk_end
        if me_month >= end:
            break
        if m == 12:
            m = 1
            y += 1
        else:
            m += 1


def reports_summary(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    person_filter: str | None = None,
) -> dict:
    """
    Analytics bundle for the reports dashboard: KPIs, trends vs prior window, breakdowns, monthly series, insights.
    """
    if start > end:
        raise ValueError('from date must be on or before to date')
    span = (end - start).days + 1
    if span > 400:
        raise ValueError('Date range cannot exceed 400 days')
    p_start, p_end = _prior_period(start, end)
    pf_exp = (person_filter or '').strip() or None

    inc = pf_finance_repo.sum_income_scoped(
        db, profile_id, start, end, account_id=account_id, person_contains=pf_exp
    )
    exp = pf_finance_repo.sum_expense_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )
    inc_p = pf_finance_repo.sum_income_scoped(
        db, profile_id, p_start, p_end, account_id=account_id, person_contains=pf_exp
    )
    exp_p = pf_finance_repo.sum_expense_scoped(
        db,
        profile_id,
        p_start,
        p_end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )

    net = inc - exp
    net_p = inc_p - exp_p

    emi_exp = pf_finance_repo.sum_expense_emi_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )
    emi_exp_p = pf_finance_repo.sum_expense_emi_scoped(
        db,
        profile_id,
        p_start,
        p_end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )

    liab_pay = pf_finance_repo.sum_liability_cash_paid_in_range(db, profile_id, start, end)
    liab_pay_p = pf_finance_repo.sum_liability_cash_paid_in_range(db, profile_id, p_start, p_end)
    emi_paid = emi_exp + liab_pay
    emi_paid_prior = emi_exp_p + liab_pay_p

    int_paid = pf_finance_repo.sum_liability_interest_paid_in_range(db, profile_id, start, end)
    int_paid_p = pf_finance_repo.sum_liability_interest_paid_in_range(db, profile_id, p_start, p_end)

    loan_given = pf_finance_repo.sum_loan_originations_in_range(db, profile_id, start, end)
    loan_given_p = pf_finance_repo.sum_loan_originations_in_range(db, profile_id, p_start, p_end)

    loan_received = pf_finance_repo.sum_loan_payments_in_range(db, profile_id, start, end)
    loan_received_p = pf_finance_repo.sum_loan_payments_in_range(db, profile_id, p_start, p_end)

    investments_added = pf_finance_repo.sum_investments_added_in_range(db, profile_id, start, end)
    investments_added_p = pf_finance_repo.sum_investments_added_in_range(db, profile_id, p_start, p_end)

    by_cat_raw = pf_finance_repo.expense_by_category_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )
    by_person_raw = pf_finance_repo.expense_by_paid_by_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )
    by_acc_raw = pf_finance_repo.expense_by_account_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )

    expense_total_for_pct = exp if exp > 0.01 else 0.0
    expense_by_category = [
        {'category': c, 'amount': round(a, 2), 'pct': _pct_share(a, expense_total_for_pct)}
        for c, a in by_cat_raw
    ]
    expense_by_person = [
        {'person': p, 'amount': round(a, 2), 'pct': _pct_share(a, expense_total_for_pct)} for p, a in by_person_raw
    ]
    expense_by_account = [
        {
            'account_id': i,
            'account_name': n,
            'amount': round(a, 2),
            'pct': _pct_share(a, expense_total_for_pct),
        }
        for i, n, a in by_acc_raw
    ]

    income_vs_expense_monthly = []
    monthly_summary = []
    for key, label, ms, me in _month_slices(start, end):
        mi = pf_finance_repo.sum_income_scoped(
            db, profile_id, ms, me, account_id=account_id, person_contains=pf_exp
        )
        mx = pf_finance_repo.sum_expense_scoped(
            db,
            profile_id,
            ms,
            me,
            account_id=account_id,
            expense_category_id=expense_category_id,
            paid_by_contains=pf_exp,
        )
        em = pf_finance_repo.sum_expense_emi_scoped(
            db,
            profile_id,
            ms,
            me,
            account_id=account_id,
            expense_category_id=expense_category_id,
            paid_by_contains=pf_exp,
        )
        income_vs_expense_monthly.append(
            {'month': key, 'label': label, 'income': round(mi, 2), 'expense': round(mx, 2)}
        )
        monthly_summary.append(
            {
                'month': key,
                'label': label,
                'income': round(mi, 2),
                'expense': round(mx, 2),
                'emi': round(em, 2),
                'net': round(mi - mx, 2),
            }
        )

    emi_other_expense = [
        {'name': 'EMI (ledger)', 'value': round(emi_exp, 2)},
        {'name': 'Other expense', 'value': round(max(0.0, exp - emi_exp), 2)},
    ]
    if liab_pay > 0.01:
        emi_other_expense.append({'name': 'Liability repayments', 'value': round(liab_pay, 2)})

    liab_break = pf_finance_repo.liability_repayments_by_loan_in_range(db, profile_id, start, end)
    emi_breakdown = [{'loan': name, 'emi_paid': round(amt, 2)} for name, amt in liab_break]

    insights: list[str] = []
    if by_cat_raw:
        top_c, top_a = by_cat_raw[0]
        insights.append(f'Highest expense category: {top_c} {top_a:,.0f} ₹')
    if by_acc_raw:
        _, acc_name, acc_amt = by_acc_raw[0]
        insights.append(f'Highest spending account: {acc_name} ({acc_amt:,.0f} ₹)')
    days = max(1, span)
    avg_daily_exp = exp / days
    approx_months = span / 30.44
    avg_monthly_exp = exp / approx_months if approx_months > 0.1 else exp
    insights.append(f'Average daily expense (period): ₹{avg_daily_exp:,.0f}')
    insights.append(f'Approx. monthly expense (scaled): ₹{avg_monthly_exp:,.0f}')
    if inc > 0.01:
        sr = (net / inc) * 100.0
        insights.append(f'Savings rate (net ÷ income): {sr:,.1f}%')
        er = (exp / inc) * 100.0
        insights.append(f'Expense ratio: {er:,.1f}% of income')
        if emi_paid > 0.01:
            eremi = (emi_paid / inc) * 100.0
            insights.append(f'Debt service & EMI (ledger + repayments) is {eremi:,.1f}% of income')
    if investments_added > 0.01 and inc > 0.01:
        insights.append(f'Investments added: ₹{investments_added:,.0f} ({investments_added / inc * 100:.1f}% of income)')

    if loan_received > 0.01:
        insights.append(f'Collected on loans you gave: ₹{loan_received:,.0f}')
    if int_paid > 0.01:
        insights.append(f'Interest paid (liabilities): ₹{int_paid:,.0f}')

    return {
        'period': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'prior_start': p_start.isoformat(),
            'prior_end': p_end.isoformat(),
            'days': span,
        },
        'filters': {
            'account_id': account_id,
            'expense_category_id': expense_category_id,
            'person': pf_exp,
        },
        'kpis': {
            'total_income': _trend_block(inc, inc_p),
            'total_expense': _trend_block(exp, exp_p),
            'net_savings': _trend_block(net, net_p),
            'emi_paid': _trend_block(emi_paid, emi_paid_prior),
            'interest_paid': _trend_block(int_paid, int_paid_p),
            'loan_given': _trend_block(loan_given, loan_given_p),
            'loan_received': _trend_block(loan_received, loan_received_p),
            'investments_added': _trend_block(investments_added, investments_added_p),
        },
        'total_income': round(inc, 2),
        'total_expense': round(exp, 2),
        'net_savings': round(net, 2),
        'emi_paid': round(emi_paid, 2),
        'emi_expense_ledger': round(emi_exp, 2),
        'liability_repayments': round(liab_pay, 2),
        'interest_paid': round(int_paid, 2),
        'loan_given': round(loan_given, 2),
        'loan_received': round(loan_received, 2),
        'investments_added': round(investments_added, 2),
        'expense_by_category': expense_by_category,
        'expense_by_person': expense_by_person,
        'expense_by_account': expense_by_account,
        'income_vs_expense_monthly': income_vs_expense_monthly,
        'monthly_summary': monthly_summary,
        'emi_breakdown': emi_breakdown,
        'emi_vs_other_expense': emi_other_expense,
        'insights': insights,
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

    Investments (cost / invested amounts), fixed assets, liabilities, and loans use **current** profile snapshots on every
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

    investments = pf_finance_repo.sum_investments_invested(db, profile_id)
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
