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
        # Don't raise the error as this is a non-critical operation
        # raise DBError(f"Failed updating collection preview") from e


async def _do_check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    """Internal function to check and set preview"""
    try:
        # Update collection preview if it is null to image_id
        db_image = await db.execute(
            select(model.Image).filter(model.Image.id == image_id)
        )
        db_image = db_image.unique().scalar_one_or_none()
        
        if db_image:
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
    except exc.NoResultFound:
        logger.warning(f"Image {image_id} not found when trying to set preview for collection {collection_id}")
    except Exception as e:
        logger.warning(f"Error setting preview image: {str(e)}")


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
        from metacheck.cruds import crud_general, crud_image, crud_meta_element
        from metacheck.schemas.metakat_object import MetaKatImport
        
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
            
            # Log the structure of imported data for debugging
            logger.info(f"MetaKat import data: batch_id={metakat_data.get('batch_id')}")
            logger.info(f"Found {len(metakat_data.get('volumes', []))} volumes")
            logger.info(f"Found {len(metakat_data.get('issues', []))} issues")
            logger.info(f"Found {len(metakat_data.get('titles', []))} titles")
            logger.info(f"Found {len(metakat_data.get('pages', []))} pages")
            logger.info(f"Found {len(metakat_data.get('detections', []))} detections")
            logger.info(f"Found {len(metakat_data.get('page_type_detections', []))} page type detections")
            
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON format in the uploaded file."
            )
        
        async with db.begin():
            # Create a new collection or check if it already exists
            collection_id = metakat_data.get("batch_id")
            if not collection_id:
                collection_id = uuid.uuid4()
                logger.warning(f"No batch_id found in import file, generating a new collection ID: {collection_id}")
            
            collection_name = f'Batch: {collection_id}'
            
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
            
            # Initialize success counters to track progress
            success_counters = {
                "volumes": 0,
                "pages": 0,
                "issues": 0,
                "titles": 0,
                "supplements": 0,
                "chapters": 0,
                "articles": 0,
                "images": 0,
                "detections": 0,
                "meta_element_detections": 0
            }
            
            # Map to keep track of image_ids by page_id for later detection processing
            page_to_image_id_map = {}
            
            # PHASE 1: Process all meta elements first (volumes, issues, titles, etc.)
            logger.info("PHASE 1: Processing meta elements...")
            
            # Process volumes
            for volume_data in metakat_data.get("volumes", []):
                try:
                    element_id = volume_data.get("id")
                    if not element_id:
                        logger.warning("Found volume without ID, skipping")
                        continue
                    
                    logger.debug(f"Processing volume: {element_id}")
                    
                    # Check if element already exists
                    element_check = await db.execute(
                        select(model.MetaElement).filter(model.MetaElement.id == element_id)
                    )
                    if element_check.unique().scalar_one_or_none():
                        # Skip if already exists
                        logger.info(f"Volume already exists: {element_id}")
                        success_counters["volumes"] += 1
                        continue
                    
                    # Create new volume with attributes
                    attributes = {}
                    # Extract all relevant fields from volume_data for attributes
                    for field in ["periodical"]:
                        if field in volume_data:
                            attributes[field] = volume_data.get(field)
                    
                    volume_element = base_objects.MetaElementNew(
                        id=element_id,
                        collection_id=collection_id,
                        meta_element_type_id=META_ELEMENT_TYPE_IDS["volume"],
                        parent_id=None,
                        attributes=attributes
                    )
                    
                    await crud_meta_element.create_meta_element(db, volume_element)
                    success_counters["volumes"] += 1
                    logger.info(f"Created volume: {element_id}")
                except Exception as e:
                    logger.warning(f"Failed to process volume {volume_data.get('id')}: {e}")
            
            # Process other element types: issues, titles, etc.
            for element_type in ["issues", "titles", "chapters", "articles", "supplements"]:
                if element_type in metakat_data and metakat_data[element_type]:
                    logger.info(f"Processing {element_type}...")
                    
                    element_type_singular = element_type[:-1]  # Remove 's' at the end
                    meta_element_type_id = META_ELEMENT_TYPE_IDS.get(element_type_singular)
                    
                    if not meta_element_type_id:
                        logger.warning(f"No meta element type ID found for {element_type_singular}, skipping")
                        continue
                    
                    for element_data in metakat_data[element_type]:
                        try:
                            element_id = element_data.get("id")
                            if not element_id:
                                logger.warning(f"Found {element_type_singular} without ID, skipping")
                                continue
                            
                            logger.debug(f"Processing {element_type_singular}: {element_id}")
                            
                            # Check if element already exists
                            element_check = await db.execute(
                                select(model.MetaElement).filter(model.MetaElement.id == element_id)
                            )
                            if element_check.unique().scalar_one_or_none():
                                logger.info(f"{element_type_singular.capitalize()} already exists: {element_id}")
                                success_counters[element_type] += 1
                                continue
                            
                            # Extract parent_id from data
                            parent_id = element_data.get("parent_id")
                            
                            # Create element with attributes from all available fields
                            attributes = {k: v for k, v in element_data.items() 
                                         if k not in ["id", "parent_id", "collection_id", "type"]}
                            
                            element_obj = base_objects.MetaElementNew(
                                id=element_id,
                                collection_id=collection_id,
                                meta_element_type_id=meta_element_type_id,
                                parent_id=parent_id,
                                attributes=attributes
                            )
                            
                            await crud_meta_element.create_meta_element(db, element_obj)
                            success_counters[element_type] += 1
                            logger.info(f"Created {element_type_singular}: {element_id}")
                        except Exception as e:
                            logger.warning(f"Failed to process {element_type_singular} {element_data.get('id')}: {e}")
            
            # PHASE 2: Process pages and their images
            logger.info("PHASE 2: Processing pages and images...")
            
            for page_data in metakat_data.get("pages", []):
                try:
                    element_id = page_data.get("id")
                    if not element_id:
                        logger.warning("Found page without ID, skipping")
                        continue
                    
                    logger.debug(f"Processing page: {element_id}")
                    
                    # Check if element already exists
                    element_check = await db.execute(
                        select(model.MetaElement).filter(model.MetaElement.id == element_id)
                    )
                    if element_check.unique().scalar_one_or_none():
                        # Check if this page already has an image
                        image_check = await db.execute(
                            select(model.Image).filter(model.Image.page_meta_element_id == element_id)
                        )
                        existing_image = image_check.unique().scalar_one_or_none()
                        
                        if existing_image:
                            logger.info(f"Page {element_id} and its image already exist")
                            page_to_image_id_map[str(element_id)] = existing_image.id
                            success_counters["pages"] += 1
                            success_counters["images"] += 1
                            continue
                        else:
                            logger.info(f"Page already exists: {element_id}")
                            success_counters["pages"] += 1
                    else:
                        # Create the page meta element
                        attributes = {
                            "pageIndex": page_data.get("pageIndex"),
                            "pageType": page_data.get("pageType", {}),
                        }
                        
                        page_element = base_objects.MetaElementNew(
                            id=element_id,
                            collection_id=collection_id,
                            meta_element_type_id=META_ELEMENT_TYPE_IDS["page"],
                            parent_id=page_data.get("parent_id"),
                            attributes=attributes
                        )
                        
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
                            existing_image = image_check.unique().scalar_one_or_none()
                            
                            if existing_image:
                                logger.info(f"Image already exists for page: {element_id}")
                                page_to_image_id_map[str(element_id)] = existing_image.id
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
                                logger.info(f"Added image for page: {element_id} with image ID: {image_id}")
                                
                                # Store the image ID for this page for later detection processing
                                page_to_image_id_map[str(element_id)] = image_id
                                success_counters["images"] += 1
                            except FileNotFoundError:
                                logger.warning(f"Image file not found: {absolute_image_path}")
                        except Exception as e:
                            logger.warning(f"Failed to add image for page {element_id}: {e}")
                except Exception as e:
                    logger.warning(f"Failed to process page {page_data.get('id')}: {e}")
            
            # PHASE 3: Process detections
            logger.info("PHASE 3: Processing detections...")
            
            # Combine regular detections and page_type_detections
            all_detections = metakat_data.get("detections", [])
            
            if all_detections:
                logger.info(f"Processing {len(all_detections)} total detections")
            
                # Fetch all meta roles to link detections to elements
                meta_roles_query = await db.execute(select(model.MetaRole))
                meta_roles = meta_roles_query.unique().scalars().all()
                
                # Create a lookup dictionary for meta roles by computed_name (e.g., "volume.title", "page.page_number")
                meta_roles_by_name = {}
                for role in meta_roles:
                    logger.info(f"Processing meta role: {role.computed_name}")
                    if hasattr(role, 'computed_name'):
                        meta_roles_by_name[role.computed_name] = role.id
                
                logger.info(f"Found {len(meta_roles_by_name)} meta roles for classification")
                logger.debug(f"Available meta roles: {list(meta_roles_by_name.keys())}")
                
                # Process each detection
                for detection in all_detections:
                    try:
                        # Store all needed values from the original dictionary
                        detection_dict = detection.copy()
                        detection_id = UUID(detection_dict.get("id"))
                        
                        # First check if detection already exists
                        detection_check = await db.execute(
                            select(model.Detection).filter(model.Detection.id == detection_id)
                        )
                        if detection_check.unique().scalar_one_or_none():
                            logger.info(f"Detection already exists: {detection_id}")
                            success_counters["detections"] += 1
                            continue
                        
                        # Get page_id from detection
                        page_id = detection_dict.get("page_id")
                        if not page_id:
                            logger.warning(f"No page found for detection: {detection_id}, skipping detection")
                            continue
                        
                        # Map page_id to image_id
                        if str(page_id) not in page_to_image_id_map:
                            logger.warning(f"No image mapping found for page: {page_id}, skipping detection {detection_id}")
                            continue
                            
                        image_id = page_to_image_id_map[str(page_id)]
                        logger.debug(f"Mapped page {page_id} to image {image_id} for detection {detection_id}")
                        
                        bbox_str = detection_dict.get("bbox")
                        
                        # Create the detection object
                        detection_obj = base_objects.DetectionNew(
                            id=detection_id,
                            image_id=str(image_id),  # Ensure image_id is a string
                            bbox=bbox_str,
                            value=detection_dict.get("value"),
                            confidence=detection_dict.get("confidence")
                        )
                        
                        # Create the detection
                        db_detection = model.Detection(**detection_obj.model_dump())
                        db.add(db_detection)
                        success_counters["detections"] += 1
                        logger.info(f"Created detection: {detection_id}")
                        
                        # Process meta attribute detections using the original dictionary
                        meta_element_id = detection_dict.get("parent_element_id")
                        meta_element_type = detection_dict.get("element_type")
                        meta_attribute_type = detection_dict.get("meta_attribute_type")
                        
                        if not meta_element_id or not meta_element_type or not meta_attribute_type:
                            logger.warning(f"Missing metadata for detection {detection_id}: element_id={meta_element_id}, type={meta_element_type}, attr={meta_attribute_type}")
                            continue
                        
                        # Find meta role for the computed name
                        computed_name = f"{meta_element_type}.{meta_attribute_type}"
                        meta_role_id = meta_roles_by_name.get(computed_name)
                        if not meta_role_id:
                            logger.warning(f"No meta role found for {computed_name}")
                            continue
                        
                        # Create MetaRoleDetection
                        meta_element_detection = base_objects.MetaElementDetectionNew(
                            id=uuid.uuid4(),
                            detection_id=detection_id,
                            meta_element_id=meta_element_id,
                            meta_role_id=meta_role_id
                        )
                        
                        # Create MetaRoleDetection
                        db_meta_element_detection = model.MetaElementDetection(**meta_element_detection.model_dump())
                        db.add(db_meta_element_detection)  
                        success_counters["meta_element_detections"] += 1
                        logger.info(f"Created meta element detection for {computed_name} on element {meta_element_id}")
                        
                    except Exception as e:
                        # Use the original dictionary for error reporting
                        detection_id = detection.get("id", "unknown")
                        logger.warning(f"Failed to process detection {detection_id}: {e}")
            
            # Update collection counts
            await db.execute(
                update(model.Collection)
                .where(model.Collection.id == collection_id)
                .values(
                    image_count=success_counters["images"],
                    detection_count=success_counters["detections"]
                )
            )
            
            logger.info(f"Import complete - collection ID: {collection_id}")
            logger.info(f"Imported: {success_counters}")
            
            # We'll let the transaction commit automatically at the end of the with block
            
            return {
                "message": "MetaKat collection imported successfully", 
                "collection_id": str(collection_id),
                "elements_imported": success_counters
            }
        
    except Exception as e:
        logger.exception(f"Failed to process MetaKat import file. Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process the MetaKat import file: {str(e)}")

