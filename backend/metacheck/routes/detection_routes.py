from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from metacheck.cruds import crud_detection
from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import detection_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=detection_route,
    schema=base_objects.Detection,
    schema_new=base_objects.DetectionNew,
    schema_update=base_objects.DetectionUpdate,
    model_class=model.Detection,
    prefix="detection",
    tags=["Detection"],
)

# Custom routes can be added below if needed 
@detection_route.post("/change_meta_role/{detection_id}/{meta_role_id}", response_model=bool, tags=["Detection"])
async def change_meta_role(detection_id: UUID, meta_role_id: UUID, session: AsyncSession = Depends(get_async_session)):
    return await crud_detection.change_detection_meta_role(detection_id, meta_role_id, session)


@detection_route.post("/update_detection_meta_role/{detection_id}/{meta_role_id}/{value}", response_model=bool, tags=["Detection"])
async def update_detection_meta_role(detection_id: UUID, meta_role_id: UUID, value: str, session: AsyncSession = Depends(get_async_session)):
    return await crud_detection.update_detection_meta_role(detection_id, meta_role_id, value, session)


@detection_route.post("/confirm/{detection_id}", response_model=bool, tags=["Detection"])
async def confirm_detection(detection_id: UUID, session: AsyncSession = Depends(get_async_session)):
    """
    Confirm a detection by setting its confidence to 1.0 and annotated to True.
    This endpoint is used to validate a detection without changing its value.
    """
    return await crud_detection.confirm_detection(detection_id, session)
