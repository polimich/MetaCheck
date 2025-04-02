import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import title_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=title_route,
    schema=base_objects.Title,
    schema_new=base_objects.TitleNew,
    schema_update=base_objects.TitleUpdate,
    model_class=model.Title,
    prefix="title",
    tags=["Title"],
)

# If needed, add custom routes below:
# @title_route.get("/custom/{param}", ...)
