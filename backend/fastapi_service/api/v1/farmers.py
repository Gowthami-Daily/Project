from fastapi import APIRouter, Depends, Query, Response, status

from fastapi_service.core.dependencies import DbSession, Pagination, get_current_user
from fastapi_service.schemas_farmer import FarmerCreate, FarmerRead, FarmerUpdate
from fastapi_service.services import farmer_service

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get('/', response_model=list[FarmerRead])
def list_farmers(
    response: Response,
    db: DbSession,
    pagination: Pagination,
    search: str | None = Query(None, description='Filter by name, code, or phone'),
) -> list[FarmerRead]:
    rows, total = farmer_service.list_farmers(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        search=search,
    )
    response.headers['X-Total-Count'] = str(total)
    return rows


@router.get('/{farmer_id}', response_model=FarmerRead)
def get_farmer(farmer_id: int, db: DbSession) -> FarmerRead:
    return farmer_service.get_farmer(db, farmer_id)


@router.post('/', response_model=FarmerRead, status_code=status.HTTP_201_CREATED)
def create_farmer(payload: FarmerCreate, db: DbSession) -> FarmerRead:
    return farmer_service.create_farmer(db, payload)


@router.put('/{farmer_id}', response_model=FarmerRead)
def update_farmer(farmer_id: int, payload: FarmerUpdate, db: DbSession) -> FarmerRead:
    return farmer_service.update_farmer(db, farmer_id, payload)


@router.delete('/{farmer_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_farmer(farmer_id: int, db: DbSession) -> Response:
    farmer_service.delete_farmer(db, farmer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
