from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import Profile, UserProfileAccess


def first_profile_id_for_user(db: Session, user_id: int) -> int | None:
    stmt = (
        select(UserProfileAccess.profile_id)
        .where(UserProfileAccess.user_id == user_id)
        .order_by(UserProfileAccess.id)
        .limit(1)
    )
    return db.scalar(stmt)


def list_profile_ids_for_user(db: Session, user_id: int) -> list[int]:
    stmt = select(UserProfileAccess.profile_id).where(UserProfileAccess.user_id == user_id)
    return list(db.scalars(stmt).all())


def get_access(db: Session, user_id: int, profile_id: int) -> UserProfileAccess | None:
    stmt = select(UserProfileAccess).where(
        UserProfileAccess.user_id == user_id,
        UserProfileAccess.profile_id == profile_id,
    )
    return db.scalars(stmt).first()


def get_profile(db: Session, profile_id: int) -> Profile | None:
    return db.get(Profile, profile_id)


def create_profile(db: Session, profile: Profile) -> Profile:
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def grant_access(db: Session, row: UserProfileAccess) -> UserProfileAccess:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_profiles_for_user(db: Session, user_id: int) -> list[tuple[Profile, str]]:
    stmt = (
        select(Profile, UserProfileAccess.permission)
        .join(UserProfileAccess, UserProfileAccess.profile_id == Profile.id)
        .where(UserProfileAccess.user_id == user_id)
        .order_by(Profile.profile_name)
    )
    return list(db.execute(stmt).all())
