import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import article_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@article_route.post("", tags=["Article"])
async def post_article(
    article_new: base_objects.ArticleNew, db: AsyncSession = Depends(get_async_session)
):
    article = article_new.model_dump()
    await crud_general.new(db, article, model.Article)


@article_route.get(
    "/{article_id}", response_model=base_objects.Article, tags=["Article"]
)
async def get_article(article_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Article, model.Article, article_id)


@article_route.put("", tags=["Article"])
async def put_article(
    article_update: base_objects.ArticleUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, article_update, model.Article)


@article_route.get("", response_model=list[base_objects.Article], tags=["Article"])
async def get_articles(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Article, model.Article)


@article_route.delete("/{article_id}", tags=["Article"])
async def delete_article(
    article_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, article_id, model.Article)
    return {"message": "Article deleted."}
