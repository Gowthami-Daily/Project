from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from fastapi_service.core.dependencies import CurrentUser, DbSession
from fastapi_service.services import pf_profile_service


def require_app_roles(*allowed: str) -> Callable:
    """Gate by normalized app role name (from ``roles`` table or legacy ``User.role``)."""

    allowed_set = {a.upper() for a in allowed}

    def checker(user: CurrentUser, db: DbSession) -> None:
        eff = pf_profile_service.resolve_effective_role_name(db, user)
        if eff == 'ADMIN' or str(user.role).upper() == 'ADMIN':
            return
        if eff not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f'Required role one of: {", ".join(sorted(allowed_set))}',
            )

    return checker


def RoleGuard(*roles: str):
    return Depends(require_app_roles(*roles))


# Presets aligned with prompt (VIEWER = dashboard-style read paths only)
AdminOnly = Annotated[None, Depends(require_app_roles('ADMIN'))]
AccountantPlus = Annotated[None, Depends(require_app_roles('ADMIN', 'ACCOUNTANT'))]
ManagerPlus = Annotated[None, Depends(require_app_roles('ADMIN', 'MANAGER', 'ACCOUNTANT'))]
DashboardReader = Annotated[
    None,
    Depends(require_app_roles('ADMIN', 'USER', 'ACCOUNTANT', 'MANAGER', 'VIEWER')),
]

# VIEWER excluded — dashboard-only role cannot open detailed reports.
ReportReader = Annotated[
    None,
    Depends(require_app_roles('ADMIN', 'USER', 'ACCOUNTANT', 'MANAGER')),
]

FinanceParticipant = Annotated[
    None,
    Depends(require_app_roles('ADMIN', 'USER', 'ACCOUNTANT')),
]
