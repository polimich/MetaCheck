import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import exc, select, update

from metacheck.database import DBError
from db import model
from metacheck.schemas import base_objects
from uuid import UUID


logger = logging.getLogger(__name__)


async def get_collection(db: AsyncSession, collection_id: UUID) -> base_objects.Collection:
    try:
        async with db.begin():
            db_collection = await db.scalar(select(model.Collection).filter(model.Collection.id == collection_id))
            collection = base_objects.Collection(**model.orm2dict(db_collection))
            return collection

    except exc.SQLAlchemyError as e:
        logger.exception(f'Failed reading collection from database')
        raise DBError(f'Failed reading collection from database') from e


async def check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    try:
        async with db.begin():
            # Update collection preview if it is null to image_id
            await db.execute(update(model.Collection)
                             .where(model.Collection.id == collection_id, model.Collection.preview_image_id == None)
                             .values(preview_image_id=image_id))

    except exc.SQLAlchemyError as e:
        logger.exception(f'Failed updating collection preview')
        raise DBError(f'Failed updating collection preview') from e