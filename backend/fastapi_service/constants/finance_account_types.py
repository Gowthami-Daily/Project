"""Canonical personal-finance account types (Phase A — taxonomy)."""

from __future__ import annotations

# Stored uppercase in DB
ALLOWED_FINANCE_ACCOUNT_TYPES: frozenset[str] = frozenset(
    {
        'BANK',
        'CASH',
        'WALLET',
        'CREDIT_CARD',
        'LOAN_GIVEN',
        'LOAN_TAKEN',
        'INVESTMENT',
        'ASSET',
    }
)

# Map legacy / free-text values (case-insensitive keys handled in normalize)
LEGACY_ACCOUNT_TYPE_MAP: dict[str, str] = {
    'savings': 'BANK',
    'saving': 'BANK',
    'current': 'BANK',
    'checking': 'BANK',
    'bank': 'BANK',
    'cash': 'CASH',
    'wallet': 'WALLET',
    'petty': 'CASH',
    'hand': 'CASH',
    'credit_card': 'CREDIT_CARD',
    'cc': 'CREDIT_CARD',
    'loan_given': 'LOAN_GIVEN',
    'loan lent': 'LOAN_GIVEN',
    'loangiven': 'LOAN_GIVEN',
    'loan_taken': 'LOAN_TAKEN',
    'loan taken': 'LOAN_TAKEN',
    'loantaken': 'LOAN_TAKEN',
    'investment': 'INVESTMENT',
    'investments': 'INVESTMENT',
    'asset': 'ASSET',
    'assets': 'ASSET',
    'other': 'BANK',
}


def normalize_finance_account_type(raw: str | None) -> str:
    """Return canonical uppercase type; unknown legacy strings default to BANK."""
    if raw is None or not str(raw).strip():
        return 'BANK'
    s = str(raw).strip()
    u = s.upper()
    if u in ALLOWED_FINANCE_ACCOUNT_TYPES:
        return u
    key = s.lower().replace('-', '_')
    if key in LEGACY_ACCOUNT_TYPE_MAP:
        return LEGACY_ACCOUNT_TYPE_MAP[key]
    # Heuristic: substring match for old data
    kl = key
    if 'wallet' in kl:
        return 'WALLET'
    if 'cash' in kl or 'petty' in kl:
        return 'CASH'
    if 'invest' in kl:
        return 'INVESTMENT'
    if 'loan' in kl and ('given' in kl or 'lent' in kl or 'receiv' in kl):
        return 'LOAN_GIVEN'
    if 'loan' in kl and ('taken' in kl or 'borrow' in kl):
        return 'LOAN_TAKEN'
    if 'credit' in kl or 'card' in kl:
        return 'CREDIT_CARD'
    if 'asset' in kl:
        return 'ASSET'
    return 'BANK'


def validate_finance_account_type(raw: str | None) -> str:
    """Strict validation for API (after normalization must be allowed)."""
    t = normalize_finance_account_type(raw)
    if t not in ALLOWED_FINANCE_ACCOUNT_TYPES:
        raise ValueError(f'account_type must be one of: {", ".join(sorted(ALLOWED_FINANCE_ACCOUNT_TYPES))}')
    return t
