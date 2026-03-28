from fastapi import APIRouter, HTTPException, status

from fastapi_service.core.dependencies import CurrentUser, DbSession
from fastapi_service.schemas_auth import TokenResponse
from fastapi_service.schemas_extended import FamilyCreate, FamilyMemberAdd, ProfileMemberOut, ProfileSwitchBody
from fastapi_service.services import auth_service, pf_profile_service
from fastapi_service.models_extended import Family, FamilyMember

router = APIRouter()


@router.get('/mine', response_model=list[ProfileMemberOut])
def list_my_profiles(user: CurrentUser, db: DbSession) -> list[dict]:
    return pf_profile_service.list_mine(db, user.id)


@router.post('/switch', response_model=TokenResponse)
def switch_profile(body: ProfileSwitchBody, user: CurrentUser, db: DbSession) -> TokenResponse:
    pf_profile_service.switch_profile(db, user.id, body.profile_id)
    token, pid = auth_service.issue_token(db, user, body.profile_id)
    return TokenResponse(access_token=token, active_profile_id=pid)


@router.post('/families', status_code=201)
def create_family(body: FamilyCreate, user: CurrentUser, db: DbSession) -> dict:
    fam = Family(family_name=body.family_name.strip(), created_by_user_id=user.id)
    db.add(fam)
    db.commit()
    db.refresh(fam)
    db.add(FamilyMember(family_id=fam.id, user_id=user.id, relation='owner'))
    db.commit()
    return {'id': fam.id, 'family_name': fam.family_name}


@router.post('/families/{family_id}/members', status_code=201)
def add_family_member(
    family_id: int,
    body: FamilyMemberAdd,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    fam = db.get(Family, family_id)
    if fam is None or fam.created_by_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not allowed')
    db.add(FamilyMember(family_id=family_id, user_id=body.user_id, relation=body.relation))
    db.commit()
    return {'ok': True}
