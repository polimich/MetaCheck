import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import issue_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=issue_route,
    schema=base_objects.Issue,
    schema_new=base_objects.IssueNew,
    schema_update=base_objects.IssueUpdate,
    model_class=model.Issue,
    prefix="issue",
    tags=["Issue"],
)

# If needed, add custom routes below:
# @issue_route.get("/custom/{param}", ...)
