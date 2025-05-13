import logging
import os
import uuid
from typing import List
from uuid import UUID

from fastapi import Depends, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db import model
from metacheck.cruds import crud_image, crud_general
from metacheck.database import DBError
from metacheck.database import get_async_session
from metacheck.routes import image_route
from metacheck.schemas import base_objects
from metacheck.schemas.base_objects import ImageUpdate
from metacheck_common.config import config

logger = logging.getLogger(__name__)

# Custom CRUD routes for Image - excluding the GET operation which is implemented separately
# The PUT operation
@image_route.put("", tags=["Image"])
async def put_image(
    image_update: ImageUpdate, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.update_obj(db, image_update, model.Image)

# The GET ALL operation
@image_route.get("", response_model=List[base_objects.Image], tags=["Image"])
async def get_all_images(db: AsyncSession = Depends(get_async_session)):
    try:
        return await crud_general.get_all(db, base_objects.Image, model.Image)
    except Exception as e:
        logger.exception(f"Error fetching images: {str(e)}")
        # Return a simplified list to avoid validation errors
        async with db.begin():
            query = select(model.Image).order_by(model.Image.created_date.desc())
            db_images = await db.execute(query)
            return [
                base_objects.Image(
                    id=img.id,
                    collection_id=img.collection_id,
                    parent_meta_element_id=img.parent_meta_element_id,
                    page_index_id=img.page_index_id,
                    name=img.name,
                    height=img.height,
                    width=img.width,
                    imagehash=img.imagehash,
                    work_state=img.work_state,
                    order=img.order,
                    page_type=img.page_type,
                    page_type_confidence=img.page_type_confidence,
                    created_date=img.created_date,
                    last_change=img.last_change,
                    last_access=img.last_access,
                    deleted=img.deleted
                )
                for img in db_images.unique().scalars().all()
            ]

# The DELETE operation
@image_route.delete("/{image_id}", tags=["Image"])
async def delete_image(
    image_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, image_id, model.Image)
    return {"message": "Image deleted."}

# Custom routes
@image_route.post("/upload/{collection_id}/{order}", tags=["Image"])
async def upload_image(
    collection_id: UUID,
    order: int,
    file: UploadFile,   
    db: AsyncSession = Depends(get_async_session),
    parent_meta_element_id: UUID = None
):
    if "image" not in file.content_type:
        raise HTTPException(
            status_code=400, detail=f"Unsuported file type - only images are supported."
        )

    image_id = uuid.uuid4()
    try:
        raw_input = file.file.read()
        await crud_image.save_image_file(
            raw_input, 
            file.filename, 
            collection_id, 
            image_id, 
            order, 
            db, 
            parent_meta_element_id=parent_meta_element_id
        )

    except DBError as e:
        logger.exception(f"Failed to upload image")
        if os.path.exists(
            await crud_image.get_image_path(image_id=image_id, collection_id=collection_id)
        ):
            os.remove(
                await crud_image.get_image_path(image_id=image_id, collection_id=collection_id)
            )
        if os.path.exists(await crud_image.get_preview_path(image_id)):
            os.remove(await crud_image.get_preview_path(image_id))
        raise HTTPException(
            status_code=400, detail="Failed to upload image and add to dataset"
        )
    finally:
        file.file.close()

    return {"message": f"Successfully uploaded {file.filename}"}

# This is needed for compatibility with other parts
@image_route.get("/{image_id}", response_model=base_objects.Image, tags=["Image"])
async def get_image(image_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_image.get_image(db, image_id)


@image_route.get("/raster/{image_id}", response_class=FileResponse, tags=["Image"])
async def get_image_raster(
    image_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    db_image = await crud_general.get(db, base_objects.Image, model.Image, image_id)
    image_path = await crud_image.get_image_path(
        image_id=image_id, collection_id=db_image.collection_id
    )
    return FileResponse(image_path)


@image_route.get("/preview/{image_id}", response_class=FileResponse, tags=["Image"])
async def image_preview(image_id: UUID, db: AsyncSession = Depends(get_async_session)):
    image_preview_path = await crud_image.get_preview_path(image_id)

    if not os.path.exists(image_preview_path):
        await crud_image.make_image_preview(db, image_id, image_preview_path)
    return FileResponse(image_preview_path)


@image_route.post("/detections/{image_id}", tags=["Image"])
async def post_image_detections(
    image_id: UUID,
    detections: List[base_objects.DetectionNew],
    db: AsyncSession = Depends(get_async_session),
):
    await crud_image.create_image_detections(db, image_id, detections)


@image_route.get(
    "/detections/{image_id}",
    response_model=List[base_objects.Detection],
    tags=["Image"],
)
async def get_image_detections(
    image_id: UUID,
    text_region_ids: List[UUID] = Query(None, alias="id[]"),
    db: AsyncSession = Depends(get_async_session),
):
    return await crud_image.get_image_detections(db, image_id, text_region_ids)


@image_route.put("/detections/{image_id}", tags=["Image"])
async def put_image_detections(
    image_id: UUID,
    text_region_updates: List[base_objects.DetectionUpdate],
    db: AsyncSession = Depends(get_async_session),
):
    await crud_image.update_image_detections(db, image_id, text_region_updates)


@image_route.post("/detections/{image_id}/create-or-update", tags=["Image"])
async def post_image_detections(
    image_id: UUID,
    detections: List[base_objects.DetectionUpdate],
    db: AsyncSession = Depends(get_async_session),
):
    await crud_image.update_or_create_image_detections(db, image_id, detections)


@image_route.delete("/detections/{detection_id}", tags=["Image"])
async def delete_image_detection(
    detection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, detection_id, model.Detection)


@image_route.put("/detections", tags=["Image"])
async def put_image_detection(
    detection_update: base_objects.DetectionUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, detection_update, model.Detection)


@image_route.post("/update_page_type/{image_id}/{page_type}", tags=["Image"])
async def update_page_type(image_id: UUID, page_type: str, db: AsyncSession = Depends(get_async_session)):
    try:
        await crud_image.update_page_type(db, image_id, page_type)
        return {"message": f"Page type updated to {page_type} for image {image_id}"}
    except DBError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@image_route.post("/update_page_index/{image_id}/{page_index}", tags=["Image"])
async def update_page_index(image_id: UUID, page_index: str, db: AsyncSession = Depends(get_async_session)):
    try:
        await crud_image.update_page_index(db, image_id, page_index)
        return {"message": f"Page index updated to {page_index} for image {image_id}"}
    except DBError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")