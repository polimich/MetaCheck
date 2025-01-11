import logging
from uuid import UUID

from sqlalchemy import exc, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


async def get_collection(
    db: AsyncSession, collection_id: UUID
) -> base_objects.Collection:
    try:
        async with db.begin():
            db_collection = await db.scalar(
                select(model.Collection).filter(model.Collection.id == collection_id)
            )
            collection = base_objects.Collection(**model.orm2dict(db_collection))
            return collection

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading collection from database")
        raise DBError(f"Failed reading collection from database") from e


async def check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    try:
        async with db.begin():
            # Update collection preview if it is null to image_id
            db_image = await db.execute(
                select(model.Image).filter(model.Image.id == image_id)
            )
            db_image = db_image.scalar_one()
            await db.execute(
                update(model.Collection)
                .where(
                    model.Collection.id == collection_id,
                    model.Collection.preview_image_id == None,
                )
                .values(
                    preview_image_id=image_id,
                    preview_image_width=db_image.width,
                    preview_image_height=db_image.height,
                )
            )

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed updating collection preview")
        raise DBError(f"Failed updating collection preview") from e


# get all collections


async def get_collections(db: AsyncSession) -> list[base_objects.Collection]:
    try:
        async with db.begin():
            db_collections = await db.execute(select(model.Collection))
            db_collections = db_collections.scalars().all()
            collections = [
                base_objects.Collection(**model.orm2dict(collection))
                for collection in db_collections
            ]
            return collections

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading collections from database")
        raise DBError(f"Failed reading collections from database") from e


# delete collection and all images from collection


async def delete_collection(db: AsyncSession, collection_id: UUID):
    try:
        async with db.begin():
            await db.execute(
                delete(model.Image).where(model.Image.collection_id == collection_id)
            )
            await db.execute(
                delete(model.Collection).where(model.Collection.id == collection_id)
            )

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed deleting collection from database")
        raise DBError(f"Failed deleting collection from database") from e


# get all images from collection


async def get_collection_images(
    db: AsyncSession, collection_id: UUID
) -> list[base_objects.Image]:
    try:
        async with db.begin():
            db_images = await db.execute(
                select(model.Image).filter(model.Image.collection_id == collection_id)
            )
            db_images = db_images.scalars().all()
            images = [
                base_objects.Image(**model.orm2dict(image)) for image in db_images
            ]
            return images

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading images from database")
        raise DBError(f"Failed reading images from database") from e
