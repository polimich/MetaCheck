import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
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
    async with db.begin():
        query = select(model.Article).where(model.Article.collection_id == collection_id)
        result = await db.execute(query)
        articles = result.unique().scalars()
        return [base_objects.Article.model_validate(article) for article in articles]
