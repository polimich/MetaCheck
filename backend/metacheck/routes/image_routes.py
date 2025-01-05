import os

import uuid
from typing import List
from uuid import UUID

import logging

import aiofiles
from aiofiles import os as aiofiles_os
from aiopath import AsyncPath
import cv2
import numpy as np
import hashlib

from db import model

from fastapi import Depends, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse

from metacheck.database import DBError

from metacheck.database import get_async_session
from metacheck.routes import image_route

from sqlalchemy.ext.asyncio import AsyncSession

from metacheck.routes.routes_aux import make_preview_from_image
from metacheck.schemas import base_objects

from metacheck.cruds import crud_image, crud_general, crud_collection

from metacheck_common.config import config
from metacheck.schemas.base_objects import ImageUpdate

logger = logging.getLogger(__name__)


@image_route.post("/upload/{collection_id}/{order}", tags=["Image"])
async def upload_image(collection_id: UUID, order: int, file: UploadFile, db: AsyncSession = Depends(get_async_session)):
    if 'image' not in file.content_type:
        raise HTTPException(status_code=400, detail=f"Unsuported file type - only images are supported.")

    image_id = uuid.uuid4()
    try:
        raw_input = file.file.read()
        await save_image(raw_input, file.filename, collection_id, image_id, order, db)

    except DBError as e:
        logger.exception(f'Failed to upload image')
        if os.path.exists(await get_image_path(image_id=image_id, collection_id=collection_id)):
            os.remove(await get_image_path(image_id=image_id, collection_id=collection_id))
        if os.path.exists(await get_preview_path(image_id)):
            os.remove(await get_preview_path(image_id))
        raise HTTPException(status_code=400, detail="Failed to upload image and add to dataset")
    finally:
        file.file.close()

    return {"message": f"Successfully uploaded {file.filename}"}


async def save_image(raw_input, image_name, collection_id, image_id, order, db: AsyncSession):
    contents = np.asarray(bytearray(raw_input), dtype="uint8")
    image = cv2.imdecode(contents, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Failed to decode/open image.")
    imagehash = hashlib.md5(raw_input).hexdigest()

    image_duplicate = await crud_image.is_image_duplicate(db, collection_id, imagehash)
    if image_duplicate:
        raise HTTPException(status_code=400, detail=f'Image is already uploaded as {image_duplicate.name}.')

    write_path = await get_image_path(image_id=image_id, collection_id=collection_id)
    async with aiofiles.open(write_path, mode='wb') as f:
        await f.write(raw_input)

    await make_preview_from_image(image, await get_preview_path(image_id),
                                  resolution=config.IMAGE_PREVIEW_RESOLUTION)

    image_new = {'id': image_id,
                 'collection_id': collection_id,
                 'order': order,
                 'name': image_name,
                 'width': image.shape[1],
                 'height': image.shape[0],
                 'deleted': False,
                 'imagehash': imagehash,
                 'work_state': model.WorkState.NEW}
    await crud_general.new(db, image_new, model.Image)

    # preview is optional, so we don't check if this goes through
    try:
        await crud_collection.check_preview_and_set(db, collection_id, image_id)
    except DBError as e:
        logger.exception(f'Failed creating image preview')


@image_route.get("/{image_id}", response_model=base_objects.Image, tags=["Image"])
async def get_image(image_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Image, model.Image, image_id)


@image_route.put("", tags=["Image"])
async def put_image(image_update: ImageUpdate, db: AsyncSession = Depends(get_async_session)):
    await crud_general.update_obj(db, image_update, model.Image)


@image_route.get("/raster/{image_id}", response_class=FileResponse, tags=["Image"])
async def get_image_raster(image_id: UUID,
                           db: AsyncSession = Depends(get_async_session)):
    db_image = await crud_general.get(db, base_objects.Image, model.Image, image_id)
    image_path = await get_image_path(image_id=image_id, collection_id=db_image.collection_id)
    return FileResponse(image_path)


@image_route.get("/preview/{image_id}", response_class=FileResponse, tags=["Image"])
async def image_preview(image_id: UUID, db: AsyncSession = Depends(get_async_session)):
    image_preview_path = AsyncPath(await get_preview_path(image_id))

    if not await image_preview_path.exists():
        await make_image_preview(db, image_id, image_preview_path)
    return FileResponse(image_preview_path)


async def get_image_path(image_id: UUID, collection_id: UUID):
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return os.path.join(path, f'{image_id}.jpg')


async def make_image_preview(db: AsyncSession, image_id: UUID, preview_path: str):
    image = await crud_general.get(db, base_objects.Image, model.Image, image_id)
    image_path = os.path.join(config.IMAGE_UPLOADED_DIR, f'{image.collection_id}', f'{image_id}.jpg')
    image = cv2.imread(image_path, 1)
    await make_preview_from_image(image, preview_path, resolution=config.IMAGE_PREVIEW_RESOLUTION)


async def get_preview_path(image_id: UUID) -> str:
    image_id = str(image_id)
    path = os.path.join(config.IMAGE_PREVIEW_DIR, image_id[:2])
    await aiofiles_os.makedirs(path, exist_ok=True)
    return os.path.join(path, f'{image_id}.jpg')


@image_route.post("/detections/{image_id}", tags=["Image"])
async def post_image_detections(image_id: UUID, detections: List[base_objects.DetectionNew],
                                  db: AsyncSession = Depends(get_async_session)):
    await crud_image.create_image_detections(db, image_id, detections)


@image_route.get("/detections/{image_id}", response_model=List[base_objects.Detection], tags=["Image"])
async def get_image_detections(image_id: UUID, text_region_ids: List[UUID] = Query(None, alias="id[]"),
                                 db: AsyncSession = Depends(get_async_session)):
    return await crud_image.get_image_detections(db, image_id, text_region_ids)


@image_route.put("/detections/{image_id}", tags=["Image"])
async def put_image_detections(image_id: UUID, text_region_updates: List[base_objects.DetectionUpdate],
                                 db: AsyncSession = Depends(get_async_session)):
    await crud_image.update_image_detections(db, image_id, text_region_updates)

@image_route.post("/detections/{image_id}/create-or-update", tags=["Image"])
async def post_image_detections(image_id: UUID, detections: List[base_objects.DetectionUpdate],
                                  db: AsyncSession = Depends(get_async_session)):
    await crud_image.update_or_create_image_detections(db, image_id, detections)

@image_route.delete("/detections/{detection_id}", tags=["Image"])
async def delete_image_detection(detection_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_general.delete_obj(db, detection_id, model.Detection)

@image_route.put("/detections", tags=["Image"])
async def put_image_detection(detection_update: base_objects.DetectionUpdate,
                                 db: AsyncSession = Depends(get_async_session)):
    await crud_general.update_obj(db, detection_update, model.Detection)