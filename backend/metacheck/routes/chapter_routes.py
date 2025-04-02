import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import chapter_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=chapter_route,
    schema=base_objects.Chapter,
    schema_new=base_objects.ChapterNew,
    schema_update=base_objects.ChapterUpdate,
    model_class=model.Chapter,
    prefix="chapter",
    tags=["Chapter"],
)

# If needed, add custom routes below:
# @chapter_route.get("/custom/{param}", ...)
