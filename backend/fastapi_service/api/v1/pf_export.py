"""Download endpoints for PDF / Excel exports (personal finance)."""

from datetime import date

from fastapi import APIRouter, HTTPException, Query, Response

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_export_service
from fastapi_service.services.rbac_service import ReportReader

router = APIRouter()


@router.get('/loans/{loan_id}/excel')
def export_loan_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    loan_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_loan_export(db, profile_id, loan_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.loan_excel_bytes(ctx)
    ln = ctx['loan']
    name = f"Loan_{ln.borrower_name.replace(' ', '_')}.xlsx"
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/loans/{loan_id}/pdf')
def export_loan_pdf(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    loan_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_loan_export(db, profile_id, loan_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.loan_pdf_bytes(ctx)
    ln = ctx['loan']
    name = f"Loan_{ln.borrower_name.replace(' ', '_')}.pdf"
    return Response(
        content=data,
        media_type='application/pdf',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/financial-statement/excel')
def export_financial_statement_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
    account_id: int | None = Query(None, description='Finance account id, or omit for all'),
    month: int | None = Query(None, ge=1, le=12, description='Optional calendar month for period + transactions'),
) -> Response:
    try:
        ctx = pf_export_service.financial_statement_context(db, profile_id, year, account_id, month)
        data = pf_export_service.financial_statement_excel_bytes(ctx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    suffix = f"_{month:02d}" if month else ''
    acc = '_all' if account_id is None else f'_acc{account_id}'
    name = f'Financial_Statement_{year}{suffix}{acc}.xlsx'
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/financial-statement/pdf')
def export_financial_statement_pdf(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
    account_id: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
) -> Response:
    try:
        ctx = pf_export_service.financial_statement_context(db, profile_id, year, account_id, month)
        data = pf_export_service.financial_statement_pdf_bytes(ctx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    suffix = f"_{month:02d}" if month else ''
    acc = '_all' if account_id is None else f'_acc{account_id}'
    name = f'Financial_Statement_{year}{suffix}{acc}.pdf'
    return Response(
        content=data,
        media_type='application/pdf',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/reports/excel')
def export_reports_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    from_date: date = Query(..., alias='from'),
    to_date: date = Query(..., alias='to'),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    person: str | None = Query(None),
) -> Response:
    try:
        ctx = pf_export_service.reports_bundle_context(
            db,
            profile_id,
            from_date,
            to_date,
            account_id=account_id,
            expense_category_id=expense_category_id,
            person=person,
        )
        data = pf_export_service.reports_excel_bytes(ctx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    name = f'Expense_Report_{from_date.isoformat()}_{to_date.isoformat()}.xlsx'
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/reports/pdf')
def export_reports_pdf(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    from_date: date = Query(..., alias='from'),
    to_date: date = Query(..., alias='to'),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    person: str | None = Query(None),
) -> Response:
    try:
        ctx = pf_export_service.reports_bundle_context(
            db,
            profile_id,
            from_date,
            to_date,
            account_id=account_id,
            expense_category_id=expense_category_id,
            person=person,
        )
        data = pf_export_service.reports_pdf_bytes(ctx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    name = f'Expense_Report_{from_date.isoformat()}_{to_date.isoformat()}.pdf'
    return Response(
        content=data,
        media_type='application/pdf',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/income/excel')
def export_income_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> Response:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail='start_date must be on or before end_date')
    data = pf_export_service.income_list_excel_bytes(db, profile_id, start_date, end_date)
    part = f'{start_date}_{end_date}' if start_date and end_date else 'all'
    name = f'Income_{part}.xlsx'.replace(':', '-')
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/expenses/excel')
def export_expenses_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> Response:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail='start_date must be on or before end_date')
    data = pf_export_service.expenses_list_excel_bytes(db, profile_id, start_date, end_date)
    part = f'{start_date}_{end_date}' if start_date and end_date else 'all'
    name = f'Expenses_{part}.xlsx'.replace(':', '-')
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(name)},
    )


@router.get('/investments/excel')
def export_investments_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    data = pf_export_service.investments_excel_bytes(db, profile_id)
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment('Investments.xlsx')},
    )


@router.get('/assets/excel')
def export_assets_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    data = pf_export_service.assets_excel_bytes(db, profile_id)
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment('Fixed_Assets.xlsx')},
    )


@router.get('/assets/{asset_id}/excel')
def export_asset_statement_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    asset_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_asset_export(db, profile_id, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.asset_statement_excel_bytes(ctx)
    base = str(ctx['enriched'].asset_name or 'asset').replace(' ', '_')[:80]
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(f'Asset_{base}.xlsx')},
    )


@router.get('/assets/{asset_id}/pdf')
def export_asset_statement_pdf(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    asset_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_asset_export(db, profile_id, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.asset_statement_pdf_bytes(ctx)
    base = str(ctx['enriched'].asset_name or 'asset').replace(' ', '_')[:80]
    return Response(
        content=data,
        media_type='application/pdf',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(f'Asset_{base}.pdf')},
    )


@router.get('/liabilities/excel')
def export_liabilities_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    data = pf_export_service.liabilities_excel_bytes(db, profile_id)
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment('Liabilities.xlsx')},
    )


@router.get('/liabilities/{liability_id}/excel')
def export_liability_statement_excel(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    liability_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_liability_statement(db, profile_id, liability_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.liability_statement_excel_bytes(ctx)
    base = str(ctx['liability'].liability_name or 'liability').replace(' ', '_')[:80]
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': pf_export_service.content_disposition_attachment(f'Liability_{base}.xlsx')
        },
    )


@router.get('/liabilities/{liability_id}/pdf')
def export_liability_statement_pdf(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    liability_id: int,
) -> Response:
    try:
        ctx = pf_export_service.gather_liability_statement(db, profile_id, liability_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    data = pf_export_service.liability_statement_pdf_bytes(ctx)
    base = str(ctx['liability'].liability_name or 'liability').replace(' ', '_')[:80]
    return Response(
        content=data,
        media_type='application/pdf',
        headers={'Content-Disposition': pf_export_service.content_disposition_attachment(f'Liability_{base}.pdf')},
    )
