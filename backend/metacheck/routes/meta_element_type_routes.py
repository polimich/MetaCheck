import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import meta_element_type_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Author: Michael Polívka xpoliv07
# Summary: API routes for managing meta element types using standard CRUD operations.

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=meta_element_type_route,
    schema=base_objects.MetaElementType,
    schema_new=base_objects.MetaElementTypeNew,
    schema_update=base_objects.MetaElementTypeUpdate,
    model_class=model.MetaElementType,
    prefix="meta_element_type",
    tags=["MetaElementType"],
)

# If needed, add custom routes below:
# @meta_element_type_route.get("/custom/{param}", ...) 