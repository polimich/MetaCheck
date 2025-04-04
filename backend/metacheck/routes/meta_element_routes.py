import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import meta_element_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=meta_element_route,
    schema=base_objects.MetaElement,
    schema_new=base_objects.MetaElementNew,
    schema_update=base_objects.MetaElementUpdate,
    model_class=model.MetaElement,
    prefix="meta_element",
    tags=["MetaElement"],
)

# If needed, add custom routes below:
# @meta_element_route.get("/custom/{param}", ...) 