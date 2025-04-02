from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general, crud_detection_type
from metacheck.database import get_async_session
from metacheck.routes import detection_type_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=detection_type_route,
    schema=base_objects.DetectionType,
    schema_new=base_objects.DetectionTypeNew,
    schema_update=base_objects.DetectionTypeUpdate,
    model_class=model.DetectionType,
    prefix="detection_type",
    tags=["Detection Type"],
)

# Custom routes for backwards compatibility
async def post_detection_type(
    detection_type_new: base_objects.DetectionTypeNew,
    db: AsyncSession = Depends(get_async_session),
):
    """Create a new detection type - maintained for backwards compatibility"""
    await crud_detection_type.create_detection_type(db, detection_type_new)

async def get_detection_types(db: AsyncSession = Depends(get_async_session)):
    """Get all detection types - maintained for backwards compatibility"""
    return await crud_detection_type.get_all_detection_types(db)

async def get_detection_type_by_name(name: str, db):
    return await crud_detection_type.get_detection_type_by_name(db, name)
