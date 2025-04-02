import logging
import os
import random
import shutil
import uuid
import zipfile
from uuid import UUID

import aiofiles
from aiofiles import os as aiofiles_os
from fastapi import Depends, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_collection, crud_general, crud_image
from metacheck.database import get_async_session
from metacheck.routes import collection_route
from metacheck.routes.detection_type_routes import (
    get_detection_types,
    post_detection_type,
    get_detection_type_by_name,
)
from metacheck.routes.image_routes import save_image, get_image
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects
from metacheck_common.config import config

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=collection_route,
    schema=base_objects.Collection,
    schema_new=base_objects.CollectionNew,
    schema_update=base_objects.CollectionUpdate,
    model_class=model.Collection,
    prefix="collection",
    tags=["Collection"],
)

# Custom routes
@collection_route.get("/eager/{collection_id}", tags=["Collection"])
async def get_collections_eager(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    return await crud_collection.get_collection_with_all_metadata(db, collection_id)

# get all images from collection
@collection_route.get(
    "/{collection_id}/images",
    response_model=list[base_objects.Image],
    tags=["Collection"],
)
async def get_collection_images(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    return await crud_collection.get_collection_images(db, collection_id)


@collection_route.post("/import_yolo", tags=["Import"])
async def import_collection_yolo(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    if "zip" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type - only zip files are supported.",
        )

    collection_id = uuid.uuid4()
    collection = base_objects.CollectionNew(
        id=collection_id, name=file.filename.replace(".zip", "")
    )
    await crud_general.new(db, collection.model_dump(), model.Collection)

    path = await get_zip_path(collection_id)
    zip_file_path = os.path.join(path, file.filename)
    extracted_dir_path = path

    try:
        # Efficient async file writing
        async with aiofiles.open(zip_file_path, mode="wb") as f:
            while chunk := await file.read(1024 * 1024):  # Read in chunks of 1MB
                await f.write(chunk)

        # Unzip file
        with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
            zip_ref.extractall(extracted_dir_path)

        # Delete the ZIP file after extraction
        os.remove(zip_file_path)

        # Read classes.txt file asynchronously
        classes_txt_path = os.path.join(extracted_dir_path, "classes.txt")
        async with aiofiles.open(classes_txt_path, mode="r") as f:
            classes = await f.read()
        classes = classes.splitlines()

        # Collect images and annotations
        images = []
        annotations = {}

        for root, _, files in os.walk(os.path.join(extracted_dir_path, "images")):
            for filename in files:
                if filename.lower().endswith((".jpg", ".jpeg", ".png")):
                    images.append((filename, os.path.join(root, filename)))

        for root, _, files in os.walk(os.path.join(extracted_dir_path, "labels")):
            for filename in files:
                if filename.lower().endswith(".txt"):
                    annotations[filename.replace(".txt", "")] = os.path.join(
                        root, filename
                    )

        # Sort images to match annotations (assuming same names)
        images.sort(key=lambda x: x[0])

        # Process images and annotations
        for index, (image_name, image_path) in enumerate(images):
            image_id = uuid.uuid4()

            # Async image file read
            async with aiofiles.open(image_path, mode="rb") as f:
                raw_input = await f.read()
            await save_image(raw_input, image_name, collection_id, image_id, index, db)

            # Get annotation file
            annotation_path = annotations.get(image_name.rsplit(".", 1)[0])
            if not annotation_path:
                continue  # Skip if no annotation file exists

            # Read annotation file asynchronously
            async with aiofiles.open(annotation_path, mode="r") as f:
                annotation_lines = await f.readlines()

            detections = []
            image_info = await get_image(image_id, db)

            for line in annotation_lines:
                parts = line.strip().split()
                if len(parts) != 5:
                    continue  # Skip malformed lines

                class_id, x_norm, y_norm, w_norm, h_norm = map(float, parts)

                image_width = image_info.width
                image_height = image_info.height

                width = w_norm * image_width
                height = h_norm * image_height
                x = x_norm * image_width - width / 2
                y = y_norm * image_height - height / 2

                bbox = f"{x};{y};{width};{height}"

                detection_types = await get_detection_types(db)
                detection_types_names = {d.name for d in detection_types}

                class_name = classes[int(class_id)]
                if class_name not in detection_types_names:
                    new_detection_type = base_objects.DetectionTypeNew(
                        id=uuid.uuid4(),
                        name=class_name,
                        color=f"#{random.randint(0, 0xFFFFFF):06x}",
                        display_name=class_name.capitalize(),
                    )
                    await post_detection_type(new_detection_type, db)
                    logger.info(f"Added new detection type: {class_name}")

                detection_type = await get_detection_type_by_name(class_name, db)
                detection = base_objects.DetectionNew(
                    id=uuid.uuid4(),
                    type_id=detection_type.id,
                    bbox=bbox,
                    image_id=image_id,
                )
                detections.append(detection)

            await crud_image.create_image_detections(db, image_id, detections)

        # Delete extracted folder
        shutil.rmtree(extracted_dir_path)

    except Exception as e:
        logger.exception(f"Failed to process file. Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process the file.")


@collection_route.post("/import_metakat", tags=["Import"])
async def import_collection_metakat(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    if "json" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsuported file type - only json files are supported.",
        )
    
    try:
        # Read and parse the JSON file
        content = await file.read()
        import json
        try:
            metakat_data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON format in the uploaded file."
            )
        
        # Create a new collection
        collection_id = uuid.uuid4()
        collection_name = metakat_data.get("name", file.filename.replace(".json", ""))
        collection = base_objects.CollectionNew(
            id=collection_id, 
            name=collection_name,
            description=metakat_data.get("description", ""),
            info=metakat_data.get("info", "")
        )
        await crud_general.new(db, collection.model_dump(), model.Collection)
        
        # Process images if present in the MetaKat format
        images_data = metakat_data.get("images", [])
        for index, image_data in enumerate(images_data):
            # Generate UUID for the image
            image_id = uuid.uuid4()
            
            # Handle image data (assuming base64 encoded or URL paths based on MetaKat format)
            image_path = image_data.get("path")
            image_name = image_data.get("name", f"image_{index}.jpg")
            
            # If image data is provided directly in the JSON
            raw_image_data = None
            if "data" in image_data and image_data["data"]:
                import base64
                try:
                    raw_image_data = base64.b64decode(image_data["data"])
                except Exception as e:
                    logger.warning(f"Failed to decode base64 image data: {e}")
                    continue
            
            # If image path is provided instead of direct data
            elif image_path:
                try:
                    # Try to read image from the path assuming it's relative to the system
                    async with aiofiles.open(image_path, mode="rb") as f:
                        raw_image_data = await f.read()
                except FileNotFoundError:
                    logger.warning(f"Image file not found: {image_path}")
                    continue
                except Exception as e:
                    logger.warning(f"Failed to read image file: {e}")
                    continue
            
            # Skip if no valid image data was found
            if not raw_image_data:
                logger.warning(f"No valid image data found for image at index {index}")
                continue
                
            # Save the image using the existing functionality
            try:
                await save_image(raw_image_data, image_name, collection_id, image_id, index, db)
            except HTTPException as e:
                logger.warning(f"Failed to save image: {e.detail}")
                continue
                
            # Process detections if present for this image
            detections_data = image_data.get("detections", [])
            if detections_data:
                # Get image info to calculate coordinates
                image_info = await get_image(image_id, db)
                
                # Process each detection
                detections = []
                for detection_data in detections_data:
                    detection_type_name = detection_data.get("type", "default")
                    
                    # Check if detection type exists, create if not
                    detection_types = await get_detection_types(db)
                    detection_types_names = {d.name for d in detection_types}
                    
                    if detection_type_name not in detection_types_names:
                        new_detection_type = base_objects.DetectionTypeNew(
                            id=uuid.uuid4(),
                            name=detection_type_name,
                            color=f"#{random.randint(0, 0xFFFFFF):06x}",
                            display_name=detection_type_name.capitalize(),
                        )
                        await post_detection_type(new_detection_type, db)
                        logger.info(f"Added new detection type: {detection_type_name}")
                    
                    detection_type = await get_detection_type_by_name(detection_type_name, db)
                    
                    # Process bounding box
                    bbox_data = detection_data.get("bbox", {})
                    if bbox_data:
                        # Handle different bbox formats (normalized or absolute)
                        if "normalized" in bbox_data and bbox_data["normalized"]:
                            # Convert normalized coordinates to absolute
                            x_norm = bbox_data.get("x", 0)
                            y_norm = bbox_data.get("y", 0)
                            w_norm = bbox_data.get("width", 0)
                            h_norm = bbox_data.get("height", 0)
                            
                            width = w_norm * image_info.width
                            height = h_norm * image_info.height
                            x = x_norm * image_info.width
                            y = y_norm * image_info.height
                        else:
                            # Use absolute coordinates directly
                            x = bbox_data.get("x", 0)
                            y = bbox_data.get("y", 0)
                            width = bbox_data.get("width", 0)
                            height = bbox_data.get("height", 0)
                        
                        bbox = f"{x};{y};{width};{height}"
                        
                        # Create detection object
                        detection = base_objects.DetectionNew(
                            id=uuid.uuid4(),
                            type_id=detection_type.id,
                            bbox=bbox,
                            image_id=image_id,
                            value=detection_data.get("value", ""),
                            confidence=detection_data.get("confidence", None)
                        )
                        detections.append(detection)
                
                # Save detections for this image
                if detections:
                    await crud_image.create_image_detections(db, image_id, detections)
        
        return {"message": "MetaKat collection imported successfully", "collection_id": str(collection_id)}
        
    except Exception as e:
        logger.exception(f"Failed to process MetaKat import file. Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process the MetaKat import file.")


async def get_zip_path(collection_id: UUID):
    path = os.path.join(await get_collection_path(collection_id), "zip")
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def get_collection_path(collection_id: UUID):
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path
