import logging

from fastapi import Depends
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from metacheck.cruds import crud_meta_role
from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import meta_role_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=meta_role_route,
    schema=base_objects.MetaRole,
    schema_new=base_objects.MetaRoleNew,
    schema_update=base_objects.MetaRoleUpdate,
    model_class=model.MetaRole,
    prefix="meta_role",
    tags=["MetaRole"],
)

@meta_role_route.get("/available_for_detection/{detection_id}",response_model=list[base_objects.MetaRole], tags=["MetaRole"])
async def get_available_for_detection(detection_id: UUID, session: AsyncSession = Depends(get_async_session)):
    return await crud_meta_role.get_available_for_detection(detection_id, session)

@meta_role_route.get("/available_for_collection/{collection_id}",response_model=list[base_objects.MetaRole], tags=["MetaRole"])
async def get_available_for_collection(collection_id: UUID, session: AsyncSession = Depends(get_async_session)):
    return await crud_meta_role.get_available_for_collection(collection_id, session)

# If needed, add custom routes below:
# @meta_role_route.get("/custom/{param}", ...) 