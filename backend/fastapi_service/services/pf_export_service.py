"""PDF and Excel export builders for personal finance (ReportLab + pandas/openpyxl)."""

from __future__ import annotations

import io
import re
from calendar import monthrange
from datetime import date, datetime
from typing import Any
from urllib.parse import quote

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import finance_expense_to_out, finance_income_to_out
from fastapi_service.services import pf_reports_service

_FOOTER_NOTE = 'Personal Finance App'


def _esc_pdf_text(s: str) -> str:
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def content_disposition_attachment(filename: str) -> str:
    safe = re.sub(r'[^\w.\- ]+', '_', filename, flags=re.UNICODE).strip() or 'export'
    safe = safe.replace(' ', '_')[:120]
    quoted = quote(filename, safe='')
    return f"attachment; filename=\"{safe}\"; filename*=UTF-8''{quoted}"


def _account_name_map(db: Session, profile_id: int) -> dict[int, str]:
    rows = pf_finance_repo.list_accounts(db, profile_id, 0, 500)
    return {a.id: a.account_name for a in rows}


def _payment_mode(p, names: dict[int, str]) -> str:
    if getattr(p, 'credit_as_cash', False):
        return 'Cash'
    aid = getattr(p, 'finance_account_id', None)
    if aid is None:
        return '—'
    return names.get(aid, f'#{aid}')


def loan_balance_due(db: Session, loan_id: int, ln) -> float:
    if ln.remaining_amount is not None:
        return max(0.0, float(ln.remaining_amount))
    sch = pf_finance_repo.list_loan_schedule(db, loan_id)
    if sch:
        return sum(float(s.emi_amount) for s in sch if str(s.payment_status).lower() != 'paid')
    pay = pf_finance_repo.list_loan_payments(db, loan_id)
    if not pay:
        return max(0.0, float(ln.loan_amount))
    return max(0.0, float(pay[0].balance_remaining))


def gather_loan_export(db: Session, profile_id: int, loan_id: int) -> dict[str, Any]:
    ln = pf_finance_repo.get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    schedule = pf_finance_repo.list_loan_schedule(db, loan_id)
    payments = pf_finance_repo.list_loan_payments(db, loan_id)
    names = _account_name_map(db, profile_id)
    total_received = sum(float(p.total_paid) for p in payments)
    balance = loan_balance_due(db, loan_id, ln)
    return {
        'loan': ln,
        'schedule': schedule,
        'payments': payments,
        'account_names': names,
        'total_given': float(ln.loan_amount),
        'total_received': total_received,
        'balance_due': balance,
    }


def loan_excel_bytes(ctx: dict[str, Any]) -> bytes:
    ln = ctx['loan']
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        summary = pd.DataFrame(
            [
                ['Borrower', ln.borrower_name],
                ['Start date', str(ln.start_date)],
                ['End date', str(ln.end_date) if ln.end_date else '—'],
                ['Status', ln.status],
                ['Interest %', float(ln.interest_rate) if ln.interest_rate is not None else '—'],
                ['Principal (total given)', ctx['total_given']],
                ['Total received', ctx['total_received']],
                ['Balance due', ctx['balance_due']],
            ],
            columns=['Field', 'Value'],
        )
        summary.to_excel(writer, sheet_name='Loan Summary', index=False)

        sch_rows = []
        for s in ctx['schedule']:
            sch_rows.append(
                {
                    'EMI #': s.emi_number,
                    'Due date': s.due_date,
                    'EMI': float(s.emi_amount),
                    'Principal': float(s.principal_amount),
                    'Interest': float(s.interest_amount),
                    'Remaining balance': float(s.remaining_balance),
                    'Status': s.payment_status,
                    'Paid date': s.payment_date or '',
                    'Amount paid': float(s.amount_paid) if s.amount_paid is not None else '',
                }
            )
        pd.DataFrame(sch_rows).to_excel(writer, sheet_name='EMI Schedule', index=False)

        pay_rows = []
        names = ctx['account_names']
        for p in ctx['payments']:
            pay_rows.append(
                {
                    'Date': p.payment_date,
                    'Total': float(p.total_paid),
                    'Principal': float(p.principal_paid),
                    'Interest': float(p.interest_paid),
                    'Balance remaining': float(p.balance_remaining),
                    'Mode': _payment_mode(p, names),
                }
            )
        pd.DataFrame(pay_rows).to_excel(writer, sheet_name='Payment History', index=False)

    return buf.getvalue()


def _pdf_styles():
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        name='ExpTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12,
        textColor=colors.HexColor('#0F172A'),
    )
    body = ParagraphStyle(
        name='ExpBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
    )
    return styles, title, body


def _pdf_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.grey)
    text = f'Generated from {_FOOTER_NOTE} on {datetime.now().strftime("%d-%b-%Y %H:%M")}'
    canvas.drawString(2 * cm, 1.2 * cm, text)
    canvas.restoreState()


def loan_pdf_bytes(ctx: dict[str, Any]) -> bytes:
    ln = ctx['loan']
    _, title_sty, body_sty = _pdf_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    story: list = []
    story.append(Paragraph('Loan Statement', title_sty))
    bn = _esc_pdf_text(ln.borrower_name)
    story.append(
        Paragraph(
            f'<b>Borrower:</b> {bn}<br/>'
            f'<b>Start date:</b> {ln.start_date}<br/>'
            f'<b>Principal:</b> ₹{ctx["total_given"]:,.2f}<br/>'
            f'<b>Interest:</b> {float(ln.interest_rate) if ln.interest_rate is not None else 0}%<br/>'
            f'<b>Balance due:</b> ₹{ctx["balance_due"]:,.2f}<br/>'
            f'<b>Status:</b> {ln.status}',
            body_sty,
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph('<b>EMI Schedule</b>', body_sty))
    sch_data = [['#', 'Due date', 'EMI', 'Principal', 'Interest', 'Status']]
    for s in ctx['schedule']:
        sch_data.append(
            [
                str(s.emi_number),
                str(s.due_date),
                f'{float(s.emi_amount):,.2f}',
                f'{float(s.principal_amount):,.2f}',
                f'{float(s.interest_amount):,.2f}',
                s.payment_status,
            ]
        )
    if len(sch_data) == 1:
        sch_data.append(['—', 'No schedule', '', '', '', ''])
    t1 = Table(sch_data, repeatRows=1)
    t1.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ]
        )
    )
    story.append(t1)
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph('<b>Payment History</b>', body_sty))
    names = ctx['account_names']
    pay_data = [['Date', 'Amount', 'Principal', 'Interest', 'Mode']]
    for p in sorted(ctx['payments'], key=lambda x: x.payment_date, reverse=True):
        pay_data.append(
            [
                str(p.payment_date),
                f'{float(p.total_paid):,.2f}',
                f'{float(p.principal_paid):,.2f}',
                f'{float(p.interest_paid):,.2f}',
                _payment_mode(p, names),
            ]
        )
    if len(pay_data) == 1:
        pay_data.append(['—', 'No payments', '', '', ''])
    t2 = Table(pay_data, repeatRows=1)
    t2.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ]
        )
    )
    story.append(t2)
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            f'<b>Total given:</b> ₹{ctx["total_given"]:,.2f}<br/>'
            f'<b>Total received:</b> ₹{ctx["total_received"]:,.2f}<br/>'
            f'<b>Balance:</b> ₹{ctx["balance_due"]:,.2f}',
            body_sty,
        )
    )

    doc.build(story, onFirstPage=_pdf_footer, onLaterPages=_pdf_footer)
    return buf.getvalue()


def financial_statement_context(
    db: Session,
    profile_id: int,
    year: int,
    account_id: int | None,
    month: int | None = None,
) -> dict[str, Any]:
    today = date.today()
    if month is not None and (month < 1 or month > 12):
        raise ValueError('month must be 1–12')
    if month is not None:
        start = date(year, month, 1)
        last = monthrange(year, month)[1]
        end = date(year, month, last)
        if end > today:
            end = today
        if start > today:
            start = end = today
    else:
        y_start = date(year, 1, 1)
        y_end = date(year, 12, 31)
        if y_start > today:
            start = end = today
        else:
            start = y_start
            end = min(y_end, today)

    pl = pf_reports_service.profit_loss(db, profile_id, start, end)
    analytics = pf_reports_service.expense_analytics(db, profile_id, start, end)
    tables = pf_reports_service.monthly_financial_tables(db, profile_id, year, account_id)
    daily = pf_reports_service.daily_ledger(db, profile_id, start, end, account_id)

    return {
        'year': year,
        'month': month,
        'account_id': account_id,
        'period_start': start,
        'period_end': end,
        'profit_loss': pl,
        'analytics': analytics,
        'monthly_tables': tables,
        'daily': daily,
    }


def financial_statement_excel_bytes(ctx: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    pl = ctx['profit_loss']
    an = ctx['analytics']
    mt = ctx['monthly_tables']
    daily = ctx['daily']

    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        period_label = (
            f"{ctx['period_start']} to {ctx['period_end']}"
            if ctx['month']
            else f"Year {ctx['year']}"
        )
        pd.DataFrame(
            [
                ['Period', period_label],
                ['Income', pl['income']],
                ['Expense', pl['expense']],
                ['Net', pl['net']],
                ['EMI expenses (window)', an.get('emi_expenses_total', 0)],
            ],
            columns=['Metric', 'Value'],
        ).to_excel(writer, sheet_name='Summary', index=False)

        rows = mt.get('rows') or []
        if rows:
            mrows = []
            for r in rows:
                inc = r.get('income_statement') or {}
                cf = r.get('cash_flow') or {}
                mrows.append(
                    {
                        'Month': r.get('label'),
                        'Income': inc.get('income'),
                        'Expense': inc.get('expense'),
                        'Net': inc.get('net_income'),
                        'Closing cash (est.)': cf.get('closing_cash_estimate'),
                    }
                )
            pd.DataFrame(mrows).to_excel(writer, sheet_name='Monthly', index=False)

        bc = an.get('by_category') or []
        pd.DataFrame([{'Category': x['category'], 'Amount': x['amount']} for x in bc]).to_excel(
            writer, sheet_name='Expense by category', index=False
        )
        bp = an.get('by_person') or []
        pd.DataFrame([{'Person': x['person'], 'Amount': x['amount']} for x in bp]).to_excel(
            writer, sheet_name='Expense by person', index=False
        )

        inc_rows = daily.get('income') or []
        exp_rows = daily.get('expenses') or []
        if not inc_rows and not exp_rows:
            pd.DataFrame([{'Note': 'No transactions in period'}]).to_excel(
                writer, sheet_name='Transactions', index=False
            )
        else:
            inc_df = pd.DataFrame(
                [
                    {
                        'Date': r.get('entry_date'),
                        'Type': 'Income',
                        'Amount': r.get('amount'),
                        'Category': r.get('income_category_label'),
                        'Detail': (r.get('received_from') or '')
                        + (f" · {r.get('description')}" if r.get('description') else ''),
                    }
                    for r in inc_rows
                ]
            )
            exp_df = pd.DataFrame(
                [
                    {
                        'Date': r.get('entry_date'),
                        'Type': 'Expense',
                        'Amount': r.get('amount'),
                        'Category': r.get('expense_category_label'),
                        'Detail': (r.get('paid_by') or '')
                        + (f" · {r.get('description')}" if r.get('description') else ''),
                    }
                    for r in exp_rows
                ]
            )
            frames = [df for df in (inc_df, exp_df) if not df.empty]
            pd.concat(frames, ignore_index=True).sort_values(
                by=['Date'], ascending=False, na_position='last'
            ).to_excel(writer, sheet_name='Transactions', index=False)

    return buf.getvalue()


def financial_statement_pdf_bytes(ctx: dict[str, Any]) -> bytes:
    _, title_sty, body_sty = _pdf_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    story: list = []
    pl = ctx['profit_loss']
    story.append(Paragraph('Financial Statement', title_sty))
    story.append(
        Paragraph(
            f'<b>Period:</b> {ctx["period_start"]} to {ctx["period_end"]}<br/>'
            f'<b>Total income:</b> ₹{pl["income"]:,.2f}<br/>'
            f'<b>Total expense:</b> ₹{pl["expense"]:,.2f}<br/>'
            f'<b>Net:</b> ₹{pl["net"]:,.2f}',
            body_sty,
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    an = ctx['analytics']
    cat_data = [['Category', 'Amount']]
    for x in (an.get('by_category') or [])[:40]:
        cat_data.append([str(x['category']), f'{float(x["amount"]):,.2f}'])
    t = Table(cat_data, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ]
        )
    )
    story.append(Paragraph('<b>Expense by category</b>', body_sty))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    per_data = [['Person', 'Amount']]
    for x in (an.get('by_person') or [])[:30]:
        per_data.append([str(x['person']), f'{float(x["amount"]):,.2f}'])
    t2 = Table(per_data, repeatRows=1)
    t2.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ]
        )
    )
    story.append(Paragraph('<b>Expense by person</b>', body_sty))
    story.append(t2)

    mt_rows = (ctx['monthly_tables'].get('rows') or [])[:12]
    if mt_rows:
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph('<b>Monthly summary</b>', body_sty))
        md = [['Month', 'Income', 'Expense', 'Net']]
        for r in mt_rows:
            inc = r.get('income_statement') or {}
            md.append(
                [
                    str(r.get('label', '')),
                    f'{float(inc.get("income", 0)):,.2f}',
                    f'{float(inc.get("expense", 0)):,.2f}',
                    f'{float(inc.get("net_income", 0)):,.2f}',
                ]
            )
        t3 = Table(md, repeatRows=1)
        t3.setStyle(
            TableStyle(
                [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ]
            )
        )
        story.append(t3)

    doc.build(story, onFirstPage=_pdf_footer, onLaterPages=_pdf_footer)
    return buf.getvalue()


def reports_bundle_context(db: Session, profile_id: int, start: date, end: date) -> dict[str, Any]:
    if start > end:
        raise ValueError('from_date must be on or before to_date')
    span = (end - start).days + 1
    if span > 400:
        raise ValueError('Date range cannot exceed 400 days')
    return {
        'start': start,
        'end': end,
        'profit_loss': pf_reports_service.profit_loss(db, profile_id, start, end),
        'analytics': pf_reports_service.expense_analytics(db, profile_id, start, end),
        'loan_report': pf_reports_service.loan_report(db, profile_id),
        'income_report': pf_reports_service.income_report(db, profile_id, start, end),
        'daily': pf_reports_service.daily_ledger(db, profile_id, start, end, None),
    }


def reports_excel_bytes(ctx: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    pl = ctx['profit_loss']
    an = ctx['analytics']
    lr = ctx['loan_report']
    daily = ctx['daily']
    bc = an.get('by_category') or []
    bp = an.get('by_person') or []
    ba = an.get('by_account') or []

    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        pd.DataFrame(
            [
                ['From', str(ctx['start'])],
                ['To', str(ctx['end'])],
                ['Income', pl['income']],
                ['Expense', pl['expense']],
                ['Net', pl['net']],
                ['Loan count', lr.get('loan_count')],
                ['Outstanding (approx)', lr.get('outstanding_approx')],
            ],
            columns=['Metric', 'Value'],
        ).to_excel(writer, sheet_name='Summary', index=False)
        pd.DataFrame([{'Category': x['category'], 'Amount': x['amount']} for x in bc]).to_excel(
            writer, sheet_name='Category totals', index=False
        )
        pd.DataFrame([{'Person': x['person'], 'Amount': x['amount']} for x in bp]).to_excel(
            writer, sheet_name='Person totals', index=False
        )
        pd.DataFrame(
            [{'Account': x['account_name'], 'Account ID': x['account_id'], 'Amount': x['amount']} for x in ba]
        ).to_excel(writer, sheet_name='Account totals', index=False)
        pd.DataFrame([{'EMI expenses total': an.get('emi_expenses_total', 0)}]).to_excel(writer, sheet_name='EMI', index=False)

        inc_rows = daily.get('income') or []
        exp_rows = daily.get('expenses') or []
        if inc_rows:
            pd.DataFrame([finance_income_to_out(r).model_dump(mode='json') for r in inc_rows]).to_excel(
                writer, sheet_name='Income lines', index=False
            )
        if exp_rows:
            pd.DataFrame([finance_expense_to_out(r).model_dump(mode='json') for r in exp_rows]).to_excel(
                writer, sheet_name='Expense lines', index=False
            )

    return buf.getvalue()


def reports_pdf_bytes(ctx: dict[str, Any]) -> bytes:
    _, title_sty, body_sty = _pdf_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    pl = ctx['profit_loss']
    an = ctx['analytics']
    lr = ctx['loan_report']
    story: list = [
        Paragraph('Expense & cash report', title_sty),
        Paragraph(
            f'<b>Period:</b> {ctx["start"]} to {ctx["end"]}<br/>'
            f'<b>Income:</b> ₹{pl["income"]:,.2f} &nbsp; <b>Expense:</b> ₹{pl["expense"]:,.2f} &nbsp; <b>Net:</b> ₹{pl["net"]:,.2f}<br/>'
            f'<b>Loans:</b> {lr.get("loan_count")} active/summary &nbsp; <b>Outstanding receivable (approx):</b> ₹{float(lr.get("outstanding_approx") or 0):,.2f}<br/>'
            f'<b>EMI-tagged expenses:</b> ₹{float(an.get("emi_expenses_total") or 0):,.2f}',
            body_sty,
        ),
        Spacer(1, 0.4 * cm),
    ]
    cat_data = [['Category', 'Amount']]
    for x in (an.get('by_category') or [])[:35]:
        cat_data.append([str(x['category'])[:40], f'{float(x["amount"]):,.2f}'])
    t = Table(cat_data, repeatRows=1, colWidths=[10 * cm, 3 * cm])
    t.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ]
        )
    )
    story.append(Paragraph('<b>Category totals</b>', body_sty))
    story.append(t)
    doc.build(story, onFirstPage=_pdf_footer, onLaterPages=_pdf_footer)
    return buf.getvalue()


def income_list_excel_bytes(db: Session, profile_id: int, start: date | None, end: date | None) -> bytes:
    rows = pf_finance_repo.list_income(db, profile_id, 0, 10000, start, end, None)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        if not rows:
            pd.DataFrame([{'Info': 'No income rows in range'}]).to_excel(writer, sheet_name='Income', index=False)
        else:
            pd.DataFrame([finance_income_to_out(r).model_dump(mode='json') for r in rows]).to_excel(
                writer, sheet_name='Income', index=False
            )
    return buf.getvalue()


def expenses_list_excel_bytes(db: Session, profile_id: int, start: date | None, end: date | None) -> bytes:
    rows = pf_finance_repo.list_expenses(db, profile_id, 0, 10000, start, end, None)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        if not rows:
            pd.DataFrame([{'Info': 'No expense rows in range'}]).to_excel(writer, sheet_name='Expenses', index=False)
        else:
            pd.DataFrame([finance_expense_to_out(r).model_dump(mode='json') for r in rows]).to_excel(
                writer, sheet_name='Expenses', index=False
            )
    return buf.getvalue()


def investments_excel_bytes(db: Session, profile_id: int) -> bytes:
    rows = pf_finance_repo.list_investments(db, profile_id, 0, 5000)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        if not rows:
            pd.DataFrame([{'Info': 'No investments'}]).to_excel(writer, sheet_name='Investments', index=False)
        else:
            data = [
                {
                    'id': r.id,
                    'investment_type': r.investment_type,
                    'invested_amount': float(r.invested_amount),
                    'current_value': float(r.current_value),
                    'platform': r.platform,
                    'as_of_date': r.as_of_date,
                }
                for r in rows
            ]
            pd.DataFrame(data).to_excel(writer, sheet_name='Investments', index=False)
    return buf.getvalue()


def assets_excel_bytes(db: Session, profile_id: int) -> bytes:
    rows = pf_finance_repo.list_assets(db, profile_id, 0, 5000)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        if not rows:
            pd.DataFrame([{'Info': 'No assets'}]).to_excel(writer, sheet_name='Assets', index=False)
        else:
            data = [
                {
                    'id': r.id,
                    'asset_name': r.asset_name,
                    'asset_type': r.asset_type,
                    'value': float(r.value),
                }
                for r in rows
            ]
            pd.DataFrame(data).to_excel(writer, sheet_name='Assets', index=False)
    return buf.getvalue()


def liabilities_excel_bytes(db: Session, profile_id: int) -> bytes:
    rows = pf_finance_repo.list_liabilities(db, profile_id, 0, 5000)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        if not rows:
            pd.DataFrame([{'Info': 'No liabilities'}]).to_excel(writer, sheet_name='Liabilities', index=False)
        else:
            data = [
                {
                    'id': r.id,
                    'liability_name': r.liability_name,
                    'liability_type': r.liability_type,
                    'amount': float(r.amount),
                    'interest_rate': float(r.interest_rate) if r.interest_rate is not None else None,
                    'due_date': r.due_date,
                }
                for r in rows
            ]
            pd.DataFrame(data).to_excel(writer, sheet_name='Liabilities', index=False)
    return buf.getvalue()
