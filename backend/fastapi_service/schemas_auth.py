from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    """Optional JSON login; Swagger also supports OAuth2 form at ``/auth/login``."""

    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1)

    @field_validator('email', mode='before')
    @classmethod
    def strip_email(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    active_profile_id: int | None = None


class UserCreate(BaseModel):
    name: str = Field(..., max_length=100)
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default='USER', max_length=50)

    @field_validator('email', mode='before')
    @classmethod
    def strip_email(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    role_id: int | None = None
    is_active: bool
    last_login: datetime | None = None


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None


class AdminUserCreateBody(BaseModel):
    name: str = Field(..., max_length=100)
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default='USER', max_length=50)

    @field_validator('email', mode='before')
    @classmethod
    def strip_email(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class AdminUserPatchBody(BaseModel):
    model_config = ConfigDict(extra='forbid')

    name: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class AdminResetPasswordBody(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class UserPermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    module_name: str
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_export: bool


class UserPermissionUpsertBody(BaseModel):
    module_name: str = Field(..., max_length=64)
    can_view: bool = True
    can_edit: bool = True
    can_delete: bool = False
    can_export: bool = True


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    detail: str | None = None
    created_at: datetime
