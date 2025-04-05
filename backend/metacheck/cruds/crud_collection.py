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
from metacheck.constants import META_ELEMENT_TYPE_IDS, ElementTypeEnum
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
            # Query the collection with all necessary relationships in a single query
            db_collection = await db.scalar(
                select(model.Collection)
                .options(
                    # Load images with their detections
                    joinedload(model.Collection.images)
                    .joinedload(model.Image.detections),
                    
                    # Load all meta elements
                    joinedload(model.Collection.meta_elements)
                )
                .filter(model.Collection.id == collection_id)
            )
            
            if not db_collection:
                raise DBError(f"Collection with ID={collection_id} not found")
            
            # Use the improved sqlalchemy_to_dict function to safely handle circular references
            from metacheck.cruds.crud_general import sqlalchemy_to_dict
            collection_dict = sqlalchemy_to_dict(db_collection)
            
            # Process meta_elements list to categorize by type
            meta_elements_by_type = {}
            
            if 'meta_elements' in collection_dict and collection_dict['meta_elements']:
                # Initialize lists
                meta_elements_by_type = {
                    'titles': [],
                    'volumes': [],
                    'issues': [],
                    'pages': [],
                    'chapters': [],
                    'articles': [],
                    'supplements': []
                }
                
                # Categorize meta elements by type
                for element in collection_dict['meta_elements']:
                    element_type_id = element.get('meta_element_type_id')
                    
                    # Reverse lookup the type name from the UUID
                    from metacheck.constants import META_ELEMENT_TYPE_NAMES
                    element_type = META_ELEMENT_TYPE_NAMES.get(str(element_type_id))
                    
                    if element_type and element_type + 's' in meta_elements_by_type:
                        meta_elements_by_type[element_type + 's'].append(element)
            
            # Update the collection dict with categorized meta elements
            collection_dict.update(meta_elements_by_type)
            
            # Create the Pydantic model from the dictionary
            collection = base_objects.CollectionWithMetadata.model_validate(collection_dict)
            
            return collection

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading collection from database: {str(e)}")
        raise DBError(f"Failed reading collection from database: {str(e)}") from e


async def check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    try:
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        
        if not is_transaction_active:
            async with db.begin():
                await _do_check_preview_and_set(db, collection_id, image_id)
        else:
            # If a transaction is already active, just run the query
            await _do_check_preview_and_set(db, collection_id, image_id)

    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed updating collection preview")
        raise DBError(f"Failed updating collection preview") from e


async def _do_check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    """Internal function to check and set preview"""
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
            detail=f"Unsupported file type - only json files are supported.",
        )
    
    try:
        # Import necessary modules here to avoid circular imports
        from backend.metacheck.cruds import crud_general, crud_image, crud_meta_element
        from backend.metacheck.schemas.metakat_object import MetaKatImport
        
        # Get the project root for resolving image paths
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_file_dir, "../../.."))
        logger.info(f"Project root directory: {project_root}")
        
        # Read and parse the JSON file
        content = await file.read()
        import json
        try:
            metakat_import = MetaKatImport.model_validate(
                json.loads(content.decode('utf-8'))
            )
            metakat_data = metakat_import.model_dump()
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON format in the uploaded file."
            )
        
        async with db.begin():
            # Create a new collection or check if it already exists
            collection_id = metakat_data.get("batch_id")
            collection_name = f'Batch: {metakat_data.get("batch_id")}'
            
            # Check if collection already exists
            collection_check = await db.execute(
                select(model.Collection).filter(model.Collection.id == collection_id)
            )
            existing_collection = collection_check.unique().scalar_one_or_none()
            
            if existing_collection:
                # Update existing collection
                await db.execute(
                    update(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .values(
                        name=collection_name,
                        description=metakat_data.get("description", ""),
                        info=metakat_data.get("info", "")
                    )
                )
                logger.info(f"Updated existing collection: {collection_id}")
            else:
                # Create new collection
                collection = base_objects.CollectionNew(
                    id=collection_id, 
                    name=collection_name,
                    description=metakat_data.get("description", ""),
                    info=metakat_data.get("info", "")
                )
                await crud_general.new(db, collection.model_dump(), model.Collection, start_transaction=False)
                logger.info(f"Created new collection: {collection_id}")
            
            # Simple counters to track progress
            success_counters = {
                "volumes": 0,
                "pages": 0,
                "issues": 0,
                "titles": 0,
                "supplements": 0,
                "chapters": 0,
                "articles": 0
            }
            
            # Process volumes - simplified
            for volume_data in metakat_data.get("volumes", []):
                try:
                    element_id = volume_data.get("id")
                    if not element_id:
                        continue
                    
                    # Check if element already exists
                    element_check = await db.execute(
                        select(model.MetaElement).filter(model.MetaElement.id == element_id)
                    )
                    if element_check.unique().scalar_one_or_none():
                        # Skip if already exists
                        logger.info(f"Volume already exists: {element_id}")
                        success_counters["volumes"] += 1
                        continue
                    
                    # Create new volume with minimal attributes
                    volume_element = base_objects.MetaElementNew(
                        id=element_id,
                        collection_id=collection_id,
                        meta_element_type_id=META_ELEMENT_TYPE_IDS["volume"],
                        parent_id=None,
                        attributes={
                            "periodical": volume_data.get("periodical", False)
                        }
                    )
                    
                    # Create directly with the simplified function
                    await crud_meta_element.create_meta_element(db, volume_element)
                    success_counters["volumes"] += 1
                    logger.info(f"Created volume: {element_id}")
                except Exception as e:
                    logger.warning(f"Failed to process volume {volume_data.get('id')}: {e}")
            
            # Process pages - simplified
            for page_data in metakat_data.get("pages", []):
                try:
                    element_id = page_data.get("id")
                    if not element_id:
                        continue
                    
                    # Check if element already exists
                    element_check = await db.execute(
                        select(model.MetaElement).filter(model.MetaElement.id == element_id)
                    )
                    if element_check.unique().scalar_one_or_none():
                        # Skip if already exists
                        logger.info(f"Page already exists: {element_id}")
                        success_counters["pages"] += 1
                        continue
                    
                    # Create with minimal attributes
                    page_element = base_objects.MetaElementNew(
                        id=element_id,
                        collection_id=collection_id,
                        meta_element_type_id=META_ELEMENT_TYPE_IDS["page"],
                        parent_id=page_data.get("parent_id"),
                        attributes={
                            "pageIndex": page_data.get("pageIndex"),
                            "pageType": page_data.get("pageType", {})
                        }
                    )
                    
                    # Create directly
                    await crud_meta_element.create_meta_element(db, page_element)
                    success_counters["pages"] += 1
                    logger.info(f"Created page: {element_id}")
                    
                    # Process image if available
                    image_path = page_data.get("image_path")
                    if image_path:
                        try:
                            # Check if an image already exists for this page
                            image_check = await db.execute(
                                select(model.Image).filter(model.Image.page_meta_element_id == element_id)
                            )
                            if image_check.unique().scalar_one_or_none():
                                logger.info(f"Image already exists for page: {element_id}")
                                continue
                                
                            # Create new image
                            image_id = uuid.uuid4()
                            
                            # Get absolute path relative to project root
                            image_name = os.path.basename(image_path)
                            
                            # Handle paths that start with a slash by removing the leading slash
                            if image_path.startswith('/'):
                                image_path = image_path[1:]
                            
                            absolute_image_path = os.path.join(project_root, image_path)
                            logger.info(f"Looking for image at: {absolute_image_path}")
                            
                            # Try to load the image
                            try:
                                async with aiofiles.open(absolute_image_path, mode="rb") as f:
                                    raw_image_data = await f.read()
                                
                                # Use the existing image handling function that will properly process the image
                                image_index = page_data.get("pageIndex", 0)
                                await crud_image.save_image_file(
                                    raw_input=raw_image_data, 
                                    image_name=image_name, 
                                    collection_id=collection_id, 
                                    image_id=image_id, 
                                    order=image_index, 
                                    db=db,
                                    page_meta_element_id=element_id
                                )
                                logger.info(f"Added image for page: {element_id} with name {image_name}")
                            except FileNotFoundError:
                                logger.warning(f"Image file not found: {absolute_image_path}")
                        except Exception as e:
                            logger.warning(f"Failed to add image for page {element_id}: {e}")
                except Exception as e:
                    logger.warning(f"Failed to process page {page_data.get('id')}: {e}")
            
            # Handle other element types if needed (issues, titles, etc.)
            # ...
            
            # Update collection counts
            await db.execute(
                update(model.Collection)
                .where(model.Collection.id == collection_id)
                .values(
                    image_count=success_counters["pages"],
                    detection_count=len(metakat_data.get("detection_to_bbox", {}))
                )
            )
            
            # We'll let the transaction commit automatically at the end of the with block
            
            return {
                "message": "MetaKat collection imported successfully", 
                "collection_id": str(collection_id),
                "elements_imported": success_counters
            }
        
    except Exception as e:
        logger.exception(f"Failed to process MetaKat import file. Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process the MetaKat import file: {str(e)}")
