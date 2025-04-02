import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import volume_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=volume_route,
    schema=base_objects.Volume,
    schema_new=base_objects.VolumeNew,
    schema_update=base_objects.VolumeUpdate,
    model_class=model.Volume,
    prefix="volume",
    tags=["Volume"],
)

# If needed, add custom routes below:
# @volume_route.get("/custom/{param}", ...)
