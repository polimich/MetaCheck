import logging
from typing import List
from uuid import UUID

from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

async def get_articles_by_collection(
    db: AsyncSession, collection_id: UUID
) -> List[base_objects.Article]:
    """Get all articles belonging to a specific collection"""
    try:
        async with db.begin():
            query = select(model.Article).where(model.Article.collection_id == collection_id)
            result = await db.execute(query)
            articles = result.unique().scalars()
            return [base_objects.Article.model_validate(article) for article in articles]
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching articles by collection from database.")
        raise DBError(f"Failed fetching articles by collection from database.") from e 