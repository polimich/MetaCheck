import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import page_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=page_route,
    schema=base_objects.Page,
    schema_new=base_objects.PageNew,
    schema_update=base_objects.PageUpdate,
    model_class=model.Page,
    prefix="page",
    tags=["Page"],
)

# If needed, add custom routes below:
# @page_route.get("/custom/{param}", ...)
