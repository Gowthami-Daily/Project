from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_credit_card_repo, pf_finance_repo
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
    """P&L-style income/expense plus ledger buckets for true bank cash in/out (external, transfers, CC pay, loans)."""
    pl = profit_loss(db, profile_id, start, end)
    if start is None or end is None:
        return {
            **pl,
            'external_deposit': None,
            'external_withdrawal': None,
            'ledger_totals_by_transaction_type': None,
            'note': 'Include start_date and end_date for account_ledger-based cash movement totals.',
        }
    ext = pf_finance_repo.sum_account_transaction_amounts_by_type(
        db, profile_id, start, end, ('EXTERNAL_DEPOSIT', 'EXTERNAL_WITHDRAWAL')
    )
    ledger = pf_finance_repo.sum_account_transaction_amounts_by_type(
        db, profile_id, start, end, pf_finance_repo.LEDGER_CASHFLOW_SUMMARY_TYPES
    )
    return {
        **pl,
        'external_deposit': round(float(ext.get('EXTERNAL_DEPOSIT', 0.0)), 2),
        'external_withdrawal': round(float(ext.get('EXTERNAL_WITHDRAWAL', 0.0)), 2),
        'ledger_totals_by_transaction_type': {k: round(v, 2) for k, v in sorted(ledger.items())},
    }


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
    cc_exp = pf_finance_repo.sum_expense_credit_card_statement(db, profile_id, start, end)
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
        'credit_card_expenses_total': round(cc_exp, 2),
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


def _balance_sheet_trend_for_range(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    account_id: int | None,
) -> list[dict]:
    """Month-end snapshots from monthly financial tables (non-cash BS lines are current-book repeats)."""
    out: list[dict] = []
    for y in range(start.year, end.year + 1):
        tbl = monthly_financial_tables(db, profile_id, y, account_id)
        for row in tbl.get('rows') or []:
            mi = int(row['month_index'])
            ms = date(y, mi, 1)
            pe = str(row['period_end'])
            me = date.fromisoformat(pe)
            if me < start or ms > end:
                continue
            bs = row['balance_sheet']
            out.append(
                {
                    'month': row['month_key'],
                    'label': row['label'],
                    'net_worth': round(float(bs.get('net_worth') or 0), 2),
                    'credit_cards_outstanding': round(float(bs.get('credit_cards_liabilities') or 0), 2),
                    'loans_payable': round(float(bs.get('loans_other_liabilities') or 0), 2),
                    'cash_estimate': round(float(bs.get('cash_estimate') or 0), 2),
                }
            )
    return out


def _expense_category_stacked_months(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None,
    expense_category_id: int | None,
    pf_exp: str | None,
    max_cats: int = 7,
) -> tuple[list[dict], list[str]]:
    month_chunks = list(_month_slices(start, end))
    per_month: list[dict[str, float]] = []
    totals: dict[str, float] = defaultdict(float)
    for _key, _label, ms, me in month_chunks:
        cats = pf_finance_repo.expense_by_category_scoped(
            db,
            profile_id,
            ms,
            me,
            account_id=account_id,
            expense_category_id=expense_category_id,
            paid_by_contains=pf_exp,
        )
        d = {str(c): float(a) for c, a in cats}
        per_month.append(d)
        for c, a in cats:
            totals[str(c)] += float(a)
    top_names = [k for k, _ in sorted(totals.items(), key=lambda x: -x[1])[:max_cats]]
    stacked: list[dict] = []
    for i, (_key, label, _ms, _me) in enumerate(month_chunks):
        pm = per_month[i]
        row: dict = {'label': label}
        other = 0.0
        for name in top_names:
            v = pm.get(name, 0.0)
            row[name] = round(v, 2)
        for k, v in pm.items():
            if k not in top_names:
                other += v
        row['Other'] = round(other, 2)
        stacked.append(row)
    return stacked, top_names + ['Other']


def _cumulative_daily_net_scoped(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None,
    expense_category_id: int | None,
    pf_exp: str | None,
) -> list[dict]:
    inc_rows = pf_finance_repo.income_by_day_scoped(
        db, profile_id, start, end, account_id=account_id, income_category_id=None, person_contains=pf_exp
    )
    exp_rows = pf_finance_repo.expense_by_day_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        paid_by_contains=pf_exp,
    )
    by_day: dict[date, float] = defaultdict(float)
    for d0, a in inc_rows:
        by_day[d0] += float(a)
    for d0, a in exp_rows:
        by_day[d0] -= float(a)
    out: list[dict] = []
    running = 0.0
    d = start
    while d <= end:
        day_net = by_day.get(d, 0.0)
        running += day_net
        out.append(
            {
                'date': d.isoformat(),
                'day_net': round(day_net, 2),
                'cumulative': round(running, 2),
            }
        )
        d += timedelta(days=1)
    return out


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

    for row in monthly_summary:
        row['savings_after_emi'] = round(
            float(row['income']) - float(row['expense']) - float(row['emi']), 2
        )

    cashflow_trend_monthly = [
        {
            'month': r['month'],
            'label': r['label'],
            'income': r['income'],
            'expense': r['expense'],
            'emi': r['emi'],
            'savings': r['savings_after_emi'],
        }
        for r in monthly_summary
    ]

    stacked_expense_months, _stack_keys = _expense_category_stacked_months(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        pf_exp=pf_exp,
    )

    cumulative_daily = _cumulative_daily_net_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
        pf_exp=pf_exp,
    )

    balance_trend = _balance_sheet_trend_for_range(db, profile_id, start, end, account_id)

    interest_collected_monthly = []
    for _key, label, ms, me in _month_slices(start, end):
        interest_collected_monthly.append(
            {
                'label': label,
                'interest': round(
                    pf_finance_repo.sum_loan_interest_collected_in_range(db, profile_id, ms, me),
                    2,
                ),
            }
        )

    cards = pf_credit_card_repo.list_cards(db, profile_id, 0, 500)
    total_cc_limit = sum(float(c.card_limit or 0) for c in cards)
    unbilled_cc = pf_credit_card_repo.sum_unbilled_for_profile(db, profile_id)
    billed_cc = pf_credit_card_repo.sum_billed_outstanding_for_profile(db, profile_id)
    cc_used = unbilled_cc + billed_cc
    credit_utilization_pct = (
        round((cc_used / total_cc_limit) * 100.0, 2) if total_cc_limit > 0.01 else 0.0
    )
    util_label = (
        'Healthy' if credit_utilization_pct <= 30 else 'Moderate' if credit_utilization_pct <= 50 else 'High'
    )

    approx_months = span / 30.44
    avg_monthly_exp_cal = exp / approx_months if approx_months > 0.1 else exp
    if account_id is not None:
        acc_row = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        cash_now = float(acc_row.balance) if acc_row else 0.0
    else:
        cash_now = pf_finance_repo.sum_account_balances(db, profile_id)
    runway_months = (
        round(cash_now / avg_monthly_exp_cal, 2) if avg_monthly_exp_cal > 0.01 else None
    )

    savings_after_emi = inc - exp - emi_exp
    savings_rate_after_emi = (savings_after_emi / inc) if inc > 0.01 else None
    expense_ratio_val = (exp / inc) if inc > 0.01 else None
    emi_ratio_income = (emi_exp / inc) if inc > 0.01 else None

    nw_change_mom = None
    if len(balance_trend) >= 2:
        nw_change_mom = round(balance_trend[-1]['net_worth'] - balance_trend[-2]['net_worth'], 2)

    mom_comparison = None
    if len(monthly_summary) >= 2:
        cur = monthly_summary[-1]
        prev = monthly_summary[-2]

        def _pc(new: float, old: float) -> float | None:
            if old < 0.01:
                return None
            return round(100.0 * (new - old) / old, 2)

        nw_this = balance_trend[-1]['net_worth'] if balance_trend else None
        nw_prev = balance_trend[-2]['net_worth'] if len(balance_trend) >= 2 else None
        mom_comparison = {
            'this_label': cur['label'],
            'prev_label': prev['label'],
            'income_this': cur['income'],
            'income_prev': prev['income'],
            'income_change_pct': _pc(float(cur['income']), float(prev['income'])),
            'expense_this': cur['expense'],
            'expense_prev': prev['expense'],
            'expense_change_pct': _pc(float(cur['expense']), float(prev['expense'])),
            'emi_this': cur['emi'],
            'emi_prev': prev['emi'],
            'emi_change_pct': _pc(float(cur['emi']), float(prev['emi'])),
            'savings_this': cur['savings_after_emi'],
            'savings_prev': prev['savings_after_emi'],
            'savings_change_pct': _pc(
                float(cur['savings_after_emi']), float(prev['savings_after_emi'])
            ),
            'net_worth_this': nw_this,
            'net_worth_prev': nw_prev,
            'net_worth_change_pct': _pc(float(nw_this or 0), float(nw_prev or 0))
            if nw_this is not None and nw_prev is not None and nw_prev > 0.01
            else None,
        }

    tail_m = monthly_summary[-3:] if len(monthly_summary) >= 3 else monthly_summary
    forecast_simple = None
    if tail_m:
        ai = sum(float(r['income']) for r in tail_m) / len(tail_m)
        ae = sum(float(r['expense']) for r in tail_m) / len(tail_m)
        aemi = sum(float(r['emi']) for r in tail_m) / len(tail_m)
        forecast_simple = {
            'avg_income': round(ai, 2),
            'avg_expense': round(ae, 2),
            'avg_emi_ledger': round(aemi, 2),
            'projected_next_month_expense': round(ae, 2),
            'projected_savings': round(ai - ae - aemi, 2),
            'note': 'Simple averages over the last months shown in this window (not a full cash-flow forecast).',
        }

    investment_book = pf_finance_repo.sum_investments_invested(db, profile_id)
    ta_last = balance_trend[-1] if balance_trend else None
    total_assets_proxy = None
    investment_ratio = None
    if ta_last:
        total_assets_proxy = float(ta_last['net_worth']) + float(
            ta_last.get('credit_cards_outstanding', 0) + ta_last.get('loans_payable', 0)
        )
        if total_assets_proxy > 0.01:
            investment_ratio = investment_book / total_assets_proxy

    account_balances_snapshot = [
        {
            'account_id': a.id,
            'account_name': a.account_name,
            'balance': round(float(a.balance), 2),
        }
        for a in pf_finance_repo.list_accounts(db, profile_id, 0, 200)
    ]
    if account_id is not None:
        account_balances_snapshot = [r for r in account_balances_snapshot if r['account_id'] == account_id]

    top5_expense_categories_bar = [{'name': c, 'amount': round(a, 2)} for c, a in by_cat_raw[:5]]

    emi_vs_income_pct = round((emi_exp / inc) * 100.0, 2) if inc > 0.01 else None

    credit_util_trend = [
        {
            'label': r['label'],
            'utilization_pct': round(
                (float(r['credit_cards_outstanding']) / total_cc_limit) * 100.0, 2
            )
            if total_cc_limit > 0.01
            else 0.0,
            'outstanding': r['credit_cards_outstanding'],
        }
        for r in balance_trend
    ]

    loan_activity_bar = [
        {'name': 'New loans (booked)', 'value': round(loan_given, 2)},
        {'name': 'Collections received', 'value': round(loan_received, 2)},
    ]

    emi_other_expense = [
        {'name': 'EMI (ledger)', 'value': round(emi_exp, 2)},
        {'name': 'Other expense', 'value': round(max(0.0, exp - emi_exp), 2)},
    ]
    if liab_pay > 0.01:
        emi_other_expense.append({'name': 'Liability repayments', 'value': round(liab_pay, 2)})

    liab_break = pf_finance_repo.liability_repayments_by_loan_in_range(db, profile_id, start, end)
    emi_breakdown = [{'loan': name, 'emi_paid': round(amt, 2)} for name, amt in liab_break]

    insights: list[str] = []
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

    if by_cat_raw and expense_total_for_pct > 0.01:
        top_c0, top_a0 = by_cat_raw[0]
        pc0 = _pct_share(top_a0, expense_total_for_pct)
        insights.append(
            f'Largest expense category is {top_c0} (~{pc0:.0f}% of spend; ₹{top_a0:,.0f}).'
        )
    if savings_rate_after_emi is not None:
        srp = savings_rate_after_emi * 100.0
        if srp < 0:
            insights.append(
                f'After ledger EMI, savings rate is negative ({srp:.1f}%): income does not cover expenses plus EMI.'
            )
        else:
            insights.append(f'After ledger EMI, savings rate is {srp:.1f}%.')
    insights.append(f'Credit utilization (cards in app): {credit_utilization_pct:.1f}% — {util_label}.')
    if runway_months is not None:
        insights.append(
            f'Liquidity runway ≈ {runway_months:.1f} months at this window’s spending pace (cash ÷ monthlyized expense).'
        )
    if nw_change_mom is not None:
        insights.append(
            f'Net worth in the accounting series moved by ₹{nw_change_mom:,.0f} vs the prior month in the trend.'
        )
    if mom_comparison and mom_comparison.get('expense_change_pct') is not None:
        insights.append(
            f'Month over month: expenses {mom_comparison["expense_change_pct"]:+.1f}% vs {mom_comparison["prev_label"]}.'
        )

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
        'advanced_metrics': {
            'savings_after_emi': round(savings_after_emi, 2),
            'savings_rate_after_emi': round(float(savings_rate_after_emi), 4)
            if savings_rate_after_emi is not None
            else None,
            'expense_ratio': round(float(expense_ratio_val), 4) if expense_ratio_val is not None else None,
            'emi_ratio_income': round(float(emi_ratio_income), 4) if emi_ratio_income is not None else None,
            'credit_utilization_pct': credit_utilization_pct,
            'avg_daily_expense': round(avg_daily_exp, 2),
            'runway_months': runway_months,
            'net_worth_change_prior_month': nw_change_mom,
        },
        'cashflow_trend_monthly': cashflow_trend_monthly,
        'cumulative_daily_cashflow': cumulative_daily,
        'expense_category_stacked_monthly': stacked_expense_months,
        'top5_expense_categories_bar': top5_expense_categories_bar,
        'balance_sheet_trend': balance_trend,
        'interest_collected_monthly': interest_collected_monthly,
        'credit_utilization_trend': credit_util_trend,
        'account_balances_snapshot': account_balances_snapshot,
        'loan_activity_bar': loan_activity_bar,
        'emi_vs_income_pct': emi_vs_income_pct,
        'month_over_month': mom_comparison,
        'forecast': forecast_simple,
        'ratio_gauges': {
            'savings_rate_pct': round(float(savings_rate_after_emi) * 100, 2)
            if savings_rate_after_emi is not None
            else None,
            'debt_to_income_emi_pct': round((emi_exp / inc) * 100, 2) if inc > 0.01 else None,
            'credit_utilization_pct': credit_utilization_pct,
            'expense_ratio_pct': round((exp / inc) * 100, 2) if inc > 0.01 else None,
            'investment_ratio_pct': round(float(investment_ratio) * 100, 2)
            if investment_ratio is not None
            else None,
        },
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
    inc = pf_finance_repo.list_income(db, profile_id, 0, 5000, start, end, account_id, None)
    exp = pf_finance_repo.list_expenses(db, profile_id, 0, 5000, start, end, account_id, None)
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
    inc = pf_finance_repo.list_income(db, profile_id, 0, 5000, from_date, to_date, account_id, None)
    exp = pf_finance_repo.list_expenses(db, profile_id, 0, 5000, from_date, to_date, account_id, None)
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
            'expense_by_category_ytd': [],
            'income_by_category_ytd': [],
            'credit_utilization_pct': 0.0,
            'cash_bank_reported': {'cash': 0.0, 'bank': 0.0, 'total': 0.0},
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
    cc_liab_out = pf_finance_repo.sum_liabilities_cc_statement_outstanding(db, profile_id)
    loans_liab_ex_cc = max(0.0, round(liabilities - cc_liab_out, 2))
    emi_due_snapshot = pf_finance_repo.sum_pending_loan_schedule_emis(db, profile_id)
    cash_bank = pf_finance_repo.sum_account_balances_cash_vs_bank(db, profile_id)
    if account_id is not None:
        acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        if acc:
            t = (acc.account_type or '').lower()
            is_cash_slot = 'cash' in t or 'wallet' in t or t in ('petty', 'hand')
            cash_bank = {
                'cash': float(acc.balance) if is_cash_slot else 0.0,
                'bank': 0.0 if is_cash_slot else float(acc.balance),
                'total': float(acc.balance),
            }
    cards = pf_credit_card_repo.list_cards(db, profile_id, 0, 500)
    total_cc_limit = sum(float(c.card_limit or 0) for c in cards)
    unbilled_cc = pf_credit_card_repo.sum_unbilled_for_profile(db, profile_id)
    billed_cc = pf_credit_card_repo.sum_billed_outstanding_for_profile(db, profile_id)
    cc_used = unbilled_cc + billed_cc
    credit_utilization_pct = round((cc_used / total_cc_limit) * 100.0, 2) if total_cc_limit > 0.01 else 0.0

    exp_by_cat_ytd = [
        {'category': a or 'Other', 'amount': round(float(b), 2)}
        for a, b in pf_finance_repo.expense_by_category(db, profile_id, ytd_start, ytd_end, account_id)
    ]
    inc_by_cat_ytd = [
        {'category': a or 'Other', 'amount': round(float(b), 2)}
        for a, b in pf_finance_repo.income_by_category(db, profile_id, ytd_start, ytd_end, account_id)
    ]

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
        exp_emi = pf_finance_repo.sum_expense_emi_categories(db, profile_id, ms, me, account_id)
        inv_add = pf_finance_repo.sum_investments_added_in_range(db, profile_id, ms, me)
        loan_pay = pf_finance_repo.sum_loan_payments_in_range(db, profile_id, ms, me)
        liab_pay = pf_finance_repo.sum_liability_cash_paid_in_range(db, profile_id, ms, me)
        cc_pay = pf_credit_card_repo.sum_cc_payments_in_range(db, profile_id, ms, me)
        financing_outflows = round(loan_pay + liab_pay + cc_pay, 2)
        investing_flow = round(-inv_add, 2)
        financing_flow = round(-financing_outflows, 2)
        cash_summary = round(net + investing_flow + financing_flow, 2)

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
                    'expense_emi': exp_emi,
                },
                'cash_flow': {
                    'cash_in_operating': inc,
                    'cash_out_operating': exp,
                    'net_operating_cash_flow': net,
                    'investing_cash_flow': investing_flow,
                    'financing_cash_flow': financing_flow,
                    'debt_service_cash': financing_outflows,
                    'investments_added': inv_add,
                    'net_cash_activity': cash_summary,
                    'closing_cash_estimate': closing_cash,
                },
                'balance_sheet': {
                    'cash_estimate': closing_cash,
                    'cash_wallet': cash_bank['cash'],
                    'bank_accounts': cash_bank['bank'],
                    'investments': investments,
                    'fixed_assets': fixed_assets,
                    'loans_given_receivable': loans_out,
                    'receivables': 0.0,
                    'total_assets': total_assets,
                    'liabilities': liabilities,
                    'credit_cards_liabilities': cc_liab_out,
                    'loans_other_liabilities': loans_liab_ex_cc,
                    'emi_installments_due': emi_due_snapshot,
                    'loans_outstanding': loans_out,
                    'net_worth': net_worth,
                },
            }
        )

    out: dict = {
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
        'expense_by_category_ytd': exp_by_cat_ytd,
        'income_by_category_ytd': inc_by_cat_ytd,
        'credit_utilization_pct': credit_utilization_pct,
        'cash_bank_reported': cash_bank,
        'rows': rows,
    }
    if rows:
        ytd_inc_tab = sum(float(r['income_statement']['income']) for r in rows)
        ytd_exp_tab = sum(float(r['income_statement']['expense']) for r in rows)
        ytd_net_tab = ytd_inc_tab - ytd_exp_tab
        ytd_emi = sum(float(r['income_statement'].get('expense_emi') or 0) for r in rows)
        last_bs = rows[-1]['balance_sheet']
        ta = float(last_bs.get('total_assets') or 0)
        inv = float(last_bs.get('investments') or 0)
        cash_e = float(last_bs.get('cash_estimate') or 0)
        avg_monthly_exp = ytd_exp_tab / max(len(rows), 1)
        out['ratios_ytd'] = {
            'savings_rate': round(ytd_net_tab / ytd_inc_tab, 4) if ytd_inc_tab > 0.01 else None,
            'debt_to_income_emi': round(ytd_emi / ytd_inc_tab, 4) if ytd_inc_tab > 0.01 else None,
            'expense_ratio': round(ytd_exp_tab / ytd_inc_tab, 4) if ytd_inc_tab > 0.01 else None,
            'credit_utilization': round(credit_utilization_pct / 100.0, 4) if total_cc_limit > 0.01 else None,
            'liquidity_months': round(cash_e / avg_monthly_exp, 2) if avg_monthly_exp > 0.01 else None,
            'investment_to_assets': round(inv / ta, 4) if ta > 0.01 else None,
        }
    return out
