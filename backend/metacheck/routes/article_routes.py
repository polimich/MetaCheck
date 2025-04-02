import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general, crud_article
from metacheck.database import get_async_session
from metacheck.routes import article_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=article_route,
    schema=base_objects.Article,
    schema_new=base_objects.ArticleNew,
    schema_update=base_objects.ArticleUpdate,
    model_class=model.Article,
    prefix="article",
    tags=["Article"],
)

# Custom routes
@article_route.get(
    "/by-collection/{collection_id}", 
    response_model=list[base_objects.Article], 
    tags=["Article"]
)
async def get_articles_by_collection(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    """Get all articles belonging to a specific collection"""
    return await crud_article.get_articles_by_collection(db, collection_id)
