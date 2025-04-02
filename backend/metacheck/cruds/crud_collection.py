import logging
import os
import random
import shutil
import uuid
import zipfile
from typing import Dict, List
from uuid import UUID

import aiofiles
from aiofiles import os as aiofiles_os
from fastapi import UploadFile, HTTPException
from sqlalchemy import exc, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects
from metacheck_common.config import config

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


async def get_collection_with_all_metadata(
    db: AsyncSession, collection_id: UUID
) -> base_objects.CollectionWithMetadata:
    try:
        async with db.begin():
            db_collection = await db.scalar(
                select(model.Collection)
                .options(
                    joinedload(model.Collection.images)
                    .joinedload(model.Image.detections)
                    .joinedload(model.Detection.type),
                    joinedload(model.Collection.titles),
                    joinedload(model.Collection.volumes),
                    joinedload(model.Collection.issues),
                    joinedload(model.Collection.chapters),
                    joinedload(model.Collection.articles),
                )
                .filter(model.Collection.id == collection_id)
            )
            collection = base_objects.CollectionWithMetadata(
                **model.orm2dict(db_collection)
            )
            print(db_collection.images[0].detections[0].type.__str__())
            loaded_images = []
            for image in db_collection.images:
                loaded_images.append(
                    base_objects.Image(
                        **model.orm2dict(image),
                        detections=[
                            base_objects.Detection(
                                **model.orm2dict(detection),
                                type=base_objects.DetectionType(
                                    **model.orm2dict(detection.type)
                                ),
                            )
                            for detection in image.detections
                        ],
                    )
                )
            collection.images = loaded_images

            collection.titles = [
                base_objects.Title(**model.orm2dict(title))
                for title in db_collection.titles
            ]

            collection.volumes = [
                base_objects.Volume(**model.orm2dict(volume))
                for volume in db_collection.volumes
            ]

            collection.issues = [
                base_objects.Issue(**model.orm2dict(issue))
                for issue in db_collection.issues
            ]

            collection.chapters = [
                base_objects.Chapter(**model.orm2dict(chapter))
                for chapter in db_collection.chapters
            ]

            collection.articles = [
                base_objects.Article(**model.orm2dict(article))
                for article in db_collection.articles
            ]

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
            db_image = db_image.unique().scalar_one()
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
            db_images = db_images.scalars().unique().all()
            images = [
                base_objects.Image(**model.orm2dict(image)) for image in db_images
            ]
            return images

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading images from database")
        raise DBError(f"Failed reading images from database") from e


async def get_zip_path(collection_id: UUID):
    path = os.path.join(await get_collection_path(collection_id), "zip")
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def get_collection_path(collection_id: UUID):
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def import_yolo_collection(file: UploadFile, db: AsyncSession):
    """Import a YOLO formatted dataset"""
    if "zip" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type - only zip files are supported.",
        )

    collection_id = uuid.uuid4()
    collection = base_objects.CollectionNew(
        id=collection_id, name=file.filename.replace(".zip", "")
    )
    
    # Import necessary modules here to avoid circular imports
    from metacheck.cruds import crud_general, crud_image, crud_detection_type
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
            await crud_image.save_image_file(raw_input, image_name, collection_id, image_id, index, db)

            # Get annotation file
            annotation_path = annotations.get(image_name.rsplit(".", 1)[0])
            if not annotation_path:
                continue  # Skip if no annotation file exists

            # Read annotation file asynchronously
            async with aiofiles.open(annotation_path, mode="r") as f:
                annotation_lines = await f.readlines()

            detections = []
            image_info = await crud_image.get_image(db, image_id)

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

                detection_types = await crud_detection_type.get_all_detection_types(db)
                detection_types_names = {d.name for d in detection_types}

                class_name = classes[int(class_id)]
                if class_name not in detection_types_names:
                    new_detection_type = base_objects.DetectionTypeNew(
                        id=uuid.uuid4(),
                        name=class_name,
                        color=f"#{random.randint(0, 0xFFFFFF):06x}",
                        display_name=class_name.capitalize(),
                    )
                    await crud_detection_type.create_detection_type(db, new_detection_type)
                    logger.info(f"Added new detection type: {class_name}")

                detection_type = await crud_detection_type.get_detection_type_by_name(db, class_name)
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
        return {"message": "YOLO collection imported successfully", "collection_id": str(collection_id)}

    except Exception as e:
        logger.exception(f"Failed to process file. Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process the file.")


async def import_metakat_collection(file: UploadFile, db: AsyncSession):
    """Import a MetaKat formatted dataset"""
    if "json" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsuported file type - only json files are supported.",
        )
    
    try:
        # Import necessary modules here to avoid circular imports
        from metacheck.cruds import crud_general, crud_image, crud_detection_type
        
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
                await crud_image.save_image_file(raw_image_data, image_name, collection_id, image_id, index, db)
            except HTTPException as e:
                logger.warning(f"Failed to save image: {e.detail}")
                continue
                
            # Process detections if present for this image
            detections_data = image_data.get("detections", [])
            if detections_data:
                # Get image info to calculate coordinates
                image_info = await crud_image.get_image(db, image_id)
                
                # Process each detection
                detections = []
                for detection_data in detections_data:
                    detection_type_name = detection_data.get("type", "default")
                    
                    # Check if detection type exists, create if not
                    detection_types = await crud_detection_type.get_all_detection_types(db)
                    detection_types_names = {d.name for d in detection_types}
                    
                    if detection_type_name not in detection_types_names:
                        new_detection_type = base_objects.DetectionTypeNew(
                            id=uuid.uuid4(),
                            name=detection_type_name,
                            color=f"#{random.randint(0, 0xFFFFFF):06x}",
                            display_name=detection_type_name.capitalize(),
                        )
                        await crud_detection_type.create_detection_type(db, new_detection_type)
                        logger.info(f"Added new detection type: {detection_type_name}")
                    
                    detection_type = await crud_detection_type.get_detection_type_by_name(db, detection_type_name)
                    
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
