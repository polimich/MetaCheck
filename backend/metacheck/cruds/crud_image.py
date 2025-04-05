import logging
import os
import hashlib
from typing import List
from uuid import UUID

import cv2
import numpy as np
import aiofiles
from aiofiles import os as aiofiles_os
from aiopath import AsyncPath
from fastapi import HTTPException
from sqlalchemy import exc, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from db import model
from metacheck.cruds.crud_aux import update_all, make_preview_from_image
from metacheck.database import DBError
from metacheck.schemas import base_objects
from metacheck_common.config import config

logger = logging.getLogger(__name__)


async def is_image_duplicate(db: AsyncSession, collection_id, img_hash):
    try:
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        
        # Use a transaction context only if one is not already active
        if not is_transaction_active:
            async with db.begin():
                return await _check_duplicate_image(db, collection_id, img_hash)
        else:
            # If a transaction is already active, just run the query
            return await _check_duplicate_image(db, collection_id, img_hash)

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed checking for duplicate image in database")
        raise DBError(f"Failed checking for duplicate image in database") from e


async def _check_duplicate_image(db: AsyncSession, collection_id, img_hash):
    """Internal function to check for duplicate images"""
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
    db_image = result.unique().scalar_one_or_none()
    if not db_image:
        return None
    return base_objects.Image.model_validate(db_image)


async def create_image_detections(
    db: AsyncSession, image_id: UUID, detections: List[base_objects.DetectionNew]
):
    try:
        async with db.begin():
            db_image = await db.scalar(
                select(model.Image).where(model.Image.id == image_id)
            )
            if not db_image:
                raise DBError(f"Image with ID {image_id} not found.")

            # Convert schema objects to ORM models
            detection_objects = [
                model.Detection(**detection.model_dump()) for detection in detections
            ]

            # Corrected: Use .extend() instead of .add_all()
            db_image.detections.extend(detection_objects)

        await db.commit()  # Ensure the changes are committed
        return db_image

    except SQLAlchemyError as e:
        await db.rollback()  # Rollback on failure
        logger.exception("Failed creating detections in database")
        raise DBError("Failed creating detections in database") from e


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


async def get_image(db: AsyncSession, image_id: UUID) -> base_objects.Image:
    try:
        async with db.begin():
            db_image = await db.scalar(
                select(model.Image)
                .options(
                    joinedload(model.Image.detections).joinedload(model.Detection.type)
                )
                .filter(model.Image.id == image_id)
            )
            image = base_objects.Image(**model.orm2dict(db_image))
            image.detections = [
                base_objects.Detection(**model.orm2dict(detection), type=detection.type)
                for detection in db_image.detections
            ]

            return image

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading image from database")
        raise DBError(f"Failed reading image from database") from e


async def save_image_file(
    raw_input, image_name, collection_id, image_id, order, db: AsyncSession, page_meta_element_id=None
):
    contents = np.asarray(bytearray(raw_input), dtype="uint8")
    image = cv2.imdecode(contents, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Failed to decode/open image.")
    imagehash = hashlib.md5(raw_input).hexdigest()

    # Check for duplicates (this now handles transactions properly)
    image_duplicate = await is_image_duplicate(db, collection_id, imagehash)
    if image_duplicate:
        raise HTTPException(
            status_code=400,
            detail=f"Image is already uploaded as {image_duplicate.name}.",
        )

    # Save image file
    write_path = await get_image_path(image_id=image_id, collection_id=collection_id)
    async with aiofiles.open(write_path, mode="wb") as f:
        await f.write(raw_input)

    # Create preview
    await make_preview_from_image(
        image,
        await get_preview_path(image_id),
        resolution=config.IMAGE_PREVIEW_RESOLUTION,
    )

    # If page_meta_element_id is not provided, we need to create a temporary one
    if page_meta_element_id is None:
        # Import here to avoid circular dependencies
        from metacheck.cruds import crud_meta_element
        from metacheck.constants import META_ELEMENT_TYPE_IDS
        from metacheck.schemas.base_objects import MetaElementNew
        import uuid

        # Create a temporary page element
        temp_page_id = uuid.uuid4()
        temp_page = MetaElementNew(
            id=temp_page_id,
            collection_id=collection_id,
            meta_element_type_id=META_ELEMENT_TYPE_IDS["page"],
            attributes={"placeholder": True}
        )
        await crud_meta_element.create_meta_element(db, temp_page)
        page_meta_element_id = temp_page_id

    # Create image record in database
    image_new = {
        "id": image_id,
        "collection_id": collection_id,
        "page_meta_element_id": page_meta_element_id,
        "name": image_name,
        "width": image.shape[1],
        "height": image.shape[0],
        "deleted": False,
        "imagehash": imagehash,
        "work_state": base_objects.WorkState.NEW,
    }
    from metacheck.cruds import crud_general
    
    # Check if transaction is active and pass that info to crud_general.new
    is_transaction_active = db.in_transaction()
    await crud_general.new(db, image_new, model.Image, start_transaction=not is_transaction_active)

    # preview is optional, so we don't check if this goes through
    try:
        from metacheck.cruds import crud_collection
        await crud_collection.check_preview_and_set(db, collection_id, image_id)
    except DBError as e:
        logger.exception(f"Failed creating image preview")
        
    return image_new


async def get_image_path(image_id: UUID, collection_id: UUID):
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return os.path.join(path, f"{image_id}.jpg")


async def make_image_preview(db: AsyncSession, image_id: UUID, preview_path: str):
    from metacheck.cruds import crud_general
    image = await crud_general.get(db, base_objects.Image, model.Image, image_id)
    image_path = os.path.join(
        config.IMAGE_UPLOADED_DIR, f"{image.collection_id}", f"{image_id}.jpg"
    )
    image = cv2.imread(image_path, 1)
    await make_preview_from_image(
        image, preview_path, resolution=config.IMAGE_PREVIEW_RESOLUTION
    )


async def get_preview_path(image_id: UUID) -> str:
    image_id = str(image_id)
    path = os.path.join(config.IMAGE_PREVIEW_DIR, image_id[:2])
    await aiofiles_os.makedirs(path, exist_ok=True)
    return os.path.join(path, f"{image_id}.jpg")
