"""
Personal finance — accounting policy (P&L, net worth, cashflow).

This module is the single in-code reference for how instruments map to books.
Implementations may not automate every branch; operators choose where manual entries apply.

Net worth (profile, dashboard)
    cash + investments + fixed_assets + loan_receivable − liabilities_outstanding
    ``AccountTransfer`` and internal moves do **not** hit P&L; they only change balances.

Loans you lend (receivable / ``loans`` + ``loan_schedule``)
    Principal disbursed: debit bank (existing loan flows).
    EMI marked paid, settlement **receipt**: credit bank; ``LoanPayment`` stores principal/interest
    split for analytics. No expense row (you are collecting).
    EMI settlement **payment** (optional framing): ``FinanceExpense`` + bank debit — use when
    the workflow should mirror “EMI as cash out” (e.g. symmetry tests).

Liabilities you borrowed (``finance_liabilities`` + ``liability_schedule``)
    **Principal received** when you take a loan is **not** auto-posted today. Choose one policy:
    (1) **Income**: record ``FinanceIncome`` (e.g. category “Loan proceeds”) when funds hit the bank
        so P&L shows inflow in the period of disbursement.
    (2) **Implicit**: only raise the liability + bank balance via manual adjustment / future automation
        with no income line (balance sheet only).
    (3) **Transfer**: treat as transfer from a clearing account (advanced; not built-in).

    **EMI paid** (schedule row): ``FinanceExpense`` (e.g. ``EMI – Loans``) + bank debit;
    ``LiabilityPayment`` captures amount/interest split; outstanding drops.

Transfers
    Never income or expense; optional notes only.

Dashboard metrics ``emis_due_selected_month``
    **lend**: unpaid ``loan_schedule`` rows with ``due_date`` in the selected calendar month
    (cash you should *receive*).
    **borrow**: unpaid ``liability_schedule`` rows in that month (cash you should *pay*).
    Together they feed cash planning; P&L for the month still comes from posted income/expense rows.
"""

POLICY_VERSION = '2026-03-01'

SHORT_SUMMARY = (
    'Transfers: non-P&L. Lending EMI receipt: bank credit + payment split. '
    'Borrowed EMI: expense + debit. Borrowed principal: manual income or implicit balance-sheet only.'
)
