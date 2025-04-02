from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

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