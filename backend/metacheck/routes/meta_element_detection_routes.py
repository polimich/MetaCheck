import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import meta_element_detection_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Author: Michael Polívka xpoliv07
# Summary: API routes for managing meta element detections using standard CRUD operations.

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=meta_element_detection_route,
    schema=base_objects.MetaElementDetection,
    schema_new=base_objects.MetaElementDetectionNew,
    schema_update=base_objects.MetaElementDetectionUpdate,
    model_class=model.MetaElementDetection,
    prefix="meta_element_detection",
    tags=["MetaElementDetection"],
)

# If needed, add custom routes below:
# @meta_element_detection_route.get("/custom/{param}", ...) 