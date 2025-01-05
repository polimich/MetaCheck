import os
import shutil
import uuid
import zipfile

import aiofiles

from fastapi import Depends, UploadFile, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession
from aiofiles import os as aiofiles_os

from db import model
from metacheck.routes import collection_route
from uuid import UUID

from metacheck.database import get_async_session
from metacheck.routes.image_routes import save_image, get_image
from metacheck.schemas import base_objects
from metacheck.cruds import crud_collection, crud_general, crud_image
from metacheck_common.config import config


import logging


logger = logging.getLogger(__name__)


@collection_route.post("",  tags=["Collection"])
async def post_collection(collection_new: base_objects.CollectionNew, db: AsyncSession = Depends(get_async_session)):
    collection = collection_new.model_dump()
    await crud_general.new(db, collection, model.Collection)


@collection_route.get("/{collection_id}", response_model=base_objects.Collection,  tags=["Collection"])
async def get_collection(collection_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_collection.get_collection(db, collection_id)


@collection_route.put("",  tags=["Collection"])
async def put_collection(collection_update: base_objects.CollectionUpdate, db: AsyncSession = Depends(get_async_session)):
    await crud_general.update_obj(db, collection_update, model.Collection)


@collection_route.get("", response_model=list[base_objects.Collection],  tags=["Collection"])
async def get_collections(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Collection, model.Collection)


@collection_route.delete("/{collection_id}",  tags=["Collection"])
async def delete_collection(collection_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_collection.delete_collection(db, collection_id)
    return {"message": "Collection deleted."}

# get all images from collection

@collection_route.get("/{collection_id}/images", response_model=list[base_objects.Image],  tags=["Collection"])
async def get_collection_images(collection_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_collection.get_collection_images(db, collection_id)

@collection_route.post("/import", tags=["Collection"])
async def import_collection(file: UploadFile, db: AsyncSession = Depends(get_async_session)):
    if 'zip' not in file.content_type:
        raise HTTPException(status_code=400, detail=f"Unsuported file type - only zip files are supported.")
    collection_id = uuid.uuid4()
    collection = base_objects.CollectionNew(id= collection_id, name=file.filename.split('.zip')[0])
    collection = collection.model_dump()
    await crud_general.new(db, collection, model.Collection)
    path = await get_zip_path(collection_id)
    zip_file_path = os.path.join(path, file.filename)
    extracked_dir_path = path
    try:
        raw_input = file.file.read()
        async with aiofiles.open(zip_file_path, mode='wb') as f:
            await f.write(raw_input)
        # unzip file
        with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
            zip_ref.extractall(path)

        #delete zip file
        if os.path.exists(zip_file_path):
            os.remove(zip_file_path)

        # get classes from txt file
        classes = []
        with open(os.path.join(extracked_dir_path, 'classes.txt'), 'r') as f:
            classes = f.read().splitlines()

        # get images from folder
        images = []
        for root, dirs, files in os.walk(os.path.join(extracked_dir_path, 'images')):
            for file in files:
                if file.endswith(('.jpg', '.jpeg', '.png')):
                    images.append((file, os.path.join(root, file)))
        # get annotations from folder
        annotations = []
        for root, dirs, files in os.walk(os.path.join(extracked_dir_path, 'labels')):
            for file in files:
                if file.endswith('.txt'):
                    annotations.append(os.path.join(root, file))

        images.sort()
        annotations.sort()

        #upload images
        for index, image in enumerate(images):
            image_id = uuid.uuid4()
            raw_input = open(image[1], 'rb').read()
            await save_image(raw_input, image[0], collection_id, image_id, index, db)
            #upload annotations
            detections = []
            image_info = await get_image(image_id, db)
            with open(annotations[index], 'r') as f:
                annotation = f.read().splitlines()
            for line in annotation:
                line = line.split(' ')
                class_id = int(line[0])
                x_normalized = float(line[1])
                y_normalized = float(line[2])
                width_normalized = float(line[3])
                height_normalized = float(line[4])

                image_width = image_info.width
                image_height = image_info.height

                width = float(width_normalized * image_width)
                height = float(height_normalized * image_height)
                x = float(x_normalized * image_width - width / 2)
                y = float(y_normalized * image_height - height / 2)

                bbox = f"{x};{y};{width};{height}"
                detection = base_objects.DetectionNew(id=uuid.uuid4(), type=classes[class_id], bbox=bbox)
                detections.append(detection)

            await crud_image.create_image_detections(db, image_id, detections)

        #delete zip folder and its content
        if os.path.exists(extracked_dir_path):
            shutil.rmtree(extracked_dir_path)

    except Exception as e:
        logger.exception(f'Failed to write file to disk. Path={zip_file_path}')
        raise HTTPException(status_code=500, detail="Failed to write file to disk.")


async def get_zip_path(collection_id: UUID):
    path = os.path.join(await get_collection_path(collection_id), 'zip')
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def get_collection_path(collection_id: UUID):
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


