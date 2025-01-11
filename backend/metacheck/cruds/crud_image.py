import logging
from typing import List
from uuid import UUID

from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds.crud_aux import update_all
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


async def is_image_duplicate(db: AsyncSession, collection_id, img_hash):
    try:
        async with db.begin():
            stm = (
                select(model.Image)
                .join(
                    model.Collection, model.Image.collection_id == model.Collection.id
                )
                .where(model.Collection.id == collection_id)
                .where(model.Image.imagehash == img_hash)
                .where(model.Image.deleted == False)
            )
            result = await db.execute(stm)
            db_image = result.scalar_one_or_none()
            if not db_image:
                return None
            return base_objects.Image.model_validate(db_image)

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed checking for duplicate image in database")
        raise DBError(f"Failed checking for duplicate image in database") from e


async def create_image_detections(
    db: AsyncSession, image_id: UUID, detections: List[base_objects.DetectionNew]
):
    try:
        async with db.begin():
            db_image = await db.scalar(
                select(model.Image).where(model.Image.id == image_id)
            )
            db_image.detections.add_all(
                [model.Detection(**detection.model_dump()) for detection in detections]
            )

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed creating detections in database")
        raise DBError(f"Failed creating detections in database") from e


async def get_image_detections(
    db: AsyncSession, image_id: UUID, detection_ids: List[UUID] = None
) -> [base_objects.Detection]:
    try:
        async with db.begin():
            if detection_ids is None:
                db_detections = await db.scalars(
                    select(model.Detection).where(model.Detection.image_id == image_id)
                )
            else:
                db_detections = await db.scalars(
                    select(model.Detection)
                    .where(model.Detection.image_id == image_id)
                    .where(model.Detection.id.in_(detection_ids))
                )
            return [
                base_objects.Detection.model_validate(detection)
                for detection in db_detections.all()
                if not detection.deleted
            ]

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading detections from database")
        raise DBError(f"Failed reading detections from database") from e


async def update_image_detections(
    db: AsyncSession,
    image_id: UUID,
    detection_updates: List[base_objects.DetectionUpdate],
):
    try:
        async with db.begin():
            db_image_detection_ids = await db.scalars(
                select(model.Detection.id).where(model.Detection.image_id == image_id)
            )
            db_image_detection_ids = list(db_image_detection_ids.all())
            valid_detection_updates = [
                detection_update
                for detection_update in detection_updates
                if detection_update.id in db_image_detection_ids
            ]
            logger.info(valid_detection_updates)
            await update_all(db, valid_detection_updates, model.Detection)

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed updating detections in database")
        raise DBError(f"Failed updating detections in database") from e


async def update_or_create_image_detections(
    db: AsyncSession,
    image_id: UUID,
    detection_updates: List[base_objects.DetectionUpdate],
):
    try:
        async with db.begin():
            db_image_detection_ids = await db.scalars(
                select(model.Detection.id).where(model.Detection.image_id == image_id)
            )
            db_image_detection_ids = list(db_image_detection_ids.all())
            valid_detection_updates = [
                detection_update
                for detection_update in detection_updates
                if detection_update.id in db_image_detection_ids
            ]
            logger.info(valid_detection_updates)
            await update_all(db, valid_detection_updates, model.Detection)
            new_detection_updates = [
                detection_update
                for detection_update in detection_updates
                if detection_update.id not in db_image_detection_ids
            ]
            if new_detection_updates:
                db_image = await db.scalar(
                    select(model.Image).where(model.Image.id == image_id)
                )
                db_image.detections.add_all(
                    [
                        model.Detection(**detection_update.model_dump())
                        for detection_update in new_detection_updates
                    ]
                )

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed updating detections in database")
        raise DBError(f"Failed updating detections in database") from e
