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
from metacheck.schemas.base_objects.collection import CollectionHierarchical, DetectionHierarchical, MetaElementHierarchical
from metacheck_common.config import config

logger = logging.getLogger(__name__)


async def get_collection(
    db: AsyncSession, collection_id: UUID
) -> base_objects.Collection:
    try:
        from metacheck.cruds import crud_general
        return await crud_general.get(db, base_objects.Collection, model.Collection, collection_id)
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
        # Get the collection with all relationships loaded
        from metacheck.cruds import crud_general
        collection = await crud_general.get(db, base_objects.Collection, model.Collection, collection_id)
        
        # Check if collection exists
        if collection is None:
            logger.warning(f"Collection with ID {collection_id} not found")
            return []
        
        # Return the images directly from the collection
        return collection.images
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
            await crud_image.save_image_file(
                raw_input, 
                image_name, 
                collection_id, 
                image_id, 
                index, 
                db
            )

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
        from metacheck.cruds import crud_general, crud_image, crud_meta_element
        from metacheck.schemas.metakat_object import MetaKatImport
        
        # Get project root for resolving image paths
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_file_dir, "../../.."))
        logger.info(f"Project root directory: {project_root}")
        
        # Parse data and process in phases
        metakat_data = await _parse_metakat_json(file)
        success_counters = {"volumes": 0, "images": 0, "issues": 0, "titles": 0, "supplements": 0, 
                           "chapters": 0, "articles": 0, "detections": 0, "meta_element_detections": 0}
        
        collection_id = await _create_or_update_collection(db, metakat_data)
        await _process_meta_elements(db, metakat_data, collection_id, success_counters)
        image_id_map = await _process_images(db, metakat_data, collection_id, project_root, success_counters)
        verification_stats = await _process_detections(db, metakat_data, collection_id, image_id_map, success_counters)
        
        # Log summary
        logger.info(f"Import complete - collection ID: {collection_id}")
        total_processed = verification_stats['success'] + verification_stats['failed']
        success_rate = (verification_stats['success'] / total_processed * 100) if total_processed > 0 else 0
        logger.info(f"VERIFICATION SUMMARY: Successfully verified {verification_stats['success']} out of {total_processed} detections ({success_rate:.2f}%)")
        if verification_stats['failed'] > 0:
            logger.warning(f"VERIFICATION WARNING: Failed to verify {verification_stats['failed']} detections")
        
        return {
            "message": "MetaKat collection imported successfully", 
            "collection_id": str(collection_id),
            "elements_imported": success_counters,
            "verification_stats": verification_stats
        }
        
    except Exception as e:
        logger.exception(f"Failed to process MetaKat import file. Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process the MetaKat import file: {str(e)}")


async def _parse_metakat_json(file: UploadFile):
    """Parse the uploaded MetaKat JSON file"""
    try:
        from metacheck.schemas.metakat_object import MetaKatImport
        content = await file.read()
        import json
        
        try:
            metakat_import = MetaKatImport.model_validate(json.loads(content.decode('utf-8')))
            metakat_data = metakat_import.model_dump()
            
            logger.info(f"MetaKat import data: batch_id={metakat_data.get('batch_id')}")
            logger.info(f"Found {len(metakat_data.get('volumes', []))} volumes, {len(metakat_data.get('issues', []))} issues, " +
                       f"{len(metakat_data.get('pages', []))} pages, {len(metakat_data.get('detections', []))} detections")
            
            return metakat_data
            
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format in the uploaded file.")
    except Exception as e:
        logger.exception(f"Error parsing MetaKat JSON: {str(e)}")
        raise


async def _create_or_update_collection(db: AsyncSession, metakat_data: dict):
    """Create a new collection or update an existing one"""
    from metacheck.cruds import crud_general

    async with db.begin():
        collection_id = metakat_data.get("batch_id")
        if not collection_id:
            collection_id = uuid.uuid4()
            logger.warning(f"No batch_id found in import file, generating a new collection ID: {collection_id}")
        
        collection_name = f'Batch: {collection_id}'
        collection_check = await db.execute(
            select(model.Collection).filter(model.Collection.id == collection_id)
        )
        existing_collection = collection_check.unique().scalar_one_or_none()
        
        if existing_collection:
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
            collection = base_objects.CollectionNew(
                id=collection_id, 
                name=collection_name,
                description=metakat_data.get("description", ""),
                info=metakat_data.get("info", "")
            )
            await crud_general.new(db, collection.model_dump(), model.Collection, start_transaction=False)
            logger.info(f"Created new collection: {collection_id}")
    
    return collection_id


async def _process_meta_elements(db: AsyncSession, metakat_data: dict, collection_id: UUID, success_counters: dict):
    """Process all meta elements (volumes, issues, titles, etc.) in hierarchical order"""
    from metacheck.cruds import crud_meta_element
    from metacheck.constants import META_ELEMENT_TYPE_IDS
    
    logger.info("PHASE 1: Processing meta elements in hierarchical order...")
    
    # Define the correct hierarchical order for processing elements
    # This ensures parent elements exist before child elements reference them
    element_processing_order = ["titles", "volumes", "issues", "chapters", "articles", "supplements"]
    
    # Process each element type in order with separate transactions
    for element_type in element_processing_order:
        if element_type not in metakat_data or not metakat_data[element_type]:
            logger.info(f"No {element_type} to process, skipping")
            continue
            
        logger.info(f"Processing {element_type}...")
        
        element_type_singular = element_type[:-1]  # Remove 's' to get singular form
        meta_element_type_id = META_ELEMENT_TYPE_IDS.get(element_type_singular)
        
        if not meta_element_type_id:
            logger.warning(f"No meta element type ID found for {element_type_singular}, skipping")
            continue
        
        # Initialize counter if not exists
        if element_type not in success_counters:
            success_counters[element_type] = 0
        
        # Process each element of the current type in a single transaction
        async with db.begin():
            for element_data in metakat_data[element_type]:
                try:
                    element_id = element_data.get("id")
                    if not element_id:
                        logger.warning(f"Found {element_type_singular} without ID, skipping")
                        continue
                    
                    # Check if element already exists
                    element_check = await db.execute(
                        select(model.MetaElement).filter(model.MetaElement.id == element_id)
                    )
                    if element_check.unique().scalar_one_or_none():
                        logger.info(f"{element_type_singular.capitalize()} already exists: {element_id}")
                        success_counters[element_type] += 1
                        continue
                    
                    # Verify parent exists if parent_id is provided
                    parent_id = element_data.get("parent_id")
                    if parent_id:
                        parent_check = await db.execute(
                            select(model.MetaElement).filter(model.MetaElement.id == parent_id)
                        )
                        parent_exists = parent_check.unique().scalar_one_or_none()
                        if not parent_exists:
                            logger.warning(f"Parent element {parent_id} for {element_type_singular} {element_id} does not exist, will be created with no parent")
                            parent_id = None
                        else:
                            logger.info(f"Found parent {parent_id} for element {element_id}")
                    
                    # Filter out fields that are not attributes
                    # Only include non-detection fields like boolean values, integers, etc.
                    attributes = {}
                    for k, v in element_data.items():
                        # Skip system fields
                        if k in ["id", "parent_id", "collection_id", "type"]:
                            continue
                            
                        # Skip detection fields (either tuple or list of tuples)
                        if isinstance(v, tuple) and len(v) == 3 and isinstance(v[0], str) and isinstance(v[1], (int, float)):
                            continue
                        if isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 3:
                            continue
                            
                        # Keep primitive values (bool, int, etc.)
                        if v is None or isinstance(v, (bool, int, float, str)):
                            attributes[k] = v
                    
                    # Create the element object
                    element_obj = base_objects.MetaElementNew(
                        id=element_id,
                        collection_id=collection_id,
                        meta_element_type_id=meta_element_type_id,
                        parent_id=parent_id,
                        attributes=attributes
                    )
                    
                    # Use the raw SQLAlchemy model to ensure all fields are set
                    db_element = model.MetaElement(
                        id=element_id,
                        collection_id=collection_id,
                        meta_element_type_id=meta_element_type_id,
                        parent_id=parent_id,
                        attributes=attributes
                    )
                    db.add(db_element)
                    
                    success_counters[element_type] += 1
                    logger.info(f"Created {element_type_singular}: {element_id} with parent_id: {parent_id}")
                    
                except Exception as e:
                    logger.warning(f"Failed to process {element_type_singular} {element_data.get('id')}: {e}")
                    logger.exception(e)
        
        # Log completion of processing for this element type
        logger.info(f"Completed processing {element_type}, created/updated {success_counters[element_type]} elements")
            
    # Verify parent-child relationships as a final check
    async with db.begin():
        logger.info("Verifying parent-child relationships...")
        all_elements = await db.execute(
            select(model.MetaElement)
            .where(model.MetaElement.collection_id == collection_id)
        )
        db_elements = all_elements.unique().scalars().all()
        
        elements_with_parent = 0
        elements_without_parent = 0
        
        for element in db_elements:
            if element.parent_id:
                elements_with_parent += 1
                parent_check = await db.execute(
                    select(model.MetaElement).filter(model.MetaElement.id == element.parent_id)
                )
                parent = parent_check.unique().scalar_one_or_none()
                if parent:
                    logger.info(f"Verified parent-child relationship: {element.id} -> {parent.id}")
                else:
                    logger.warning(f"Element {element.id} has parent_id {element.parent_id} but parent doesn't exist")
            else:
                elements_without_parent += 1
        
        logger.info(f"Parent-child verification complete. Elements with parents: {elements_with_parent}, root elements: {elements_without_parent}")


async def _process_images(db: AsyncSession, metakat_data: dict, collection_id: UUID, project_root: str, success_counters: dict):
    """Process and save images to the database, returns a map of image IDs"""
    from metacheck.cruds import crud_image
    
    logger.info("PHASE 2: Processing images...")
    image_id_map = {}
    
    async with db.begin():
        for page_data in metakat_data.get("pages", []):
            try:
                image_id = page_data.get("id")
                if not image_id:
                    logger.warning("Found page without ID, skipping")
                    continue
                
                image_check = await db.execute(
                    select(model.Image).filter(model.Image.id == image_id)
                )
                existing_image = image_check.unique().scalar_one_or_none()
                
                if existing_image:
                    logger.info(f"Image already exists: {image_id}")
                    image_id_map[str(image_id)] = image_id
                    success_counters["images"] += 1
                    continue
                
                parent_meta_element_id = page_data.get("parent_id")
                if not parent_meta_element_id:
                    logger.warning(f"No parent element found for image: {image_id}, skipping")
                    continue
                
                image_path = page_data.get("image_path")
                if image_path:
                    image_name = os.path.basename(image_path)
                    if image_path.startswith('/'):
                        image_path = image_path[1:]
                    
                    absolute_image_path = os.path.join(project_root, image_path)
                    logger.info(f"Looking for image at: {absolute_image_path}")
                    
                    try:
                        try:
                            async with aiofiles.open(absolute_image_path, mode="rb") as f:
                                raw_image_data = await f.read()
                        except FileNotFoundError:
                            logger.warning(f"Image file not found: {absolute_image_path}")
                            continue
                        
                        page_type_info = page_data.get("pageType", {})
                        page_type_value = None
                        page_type_confidence = None
                        
                        if isinstance(page_type_info, dict):
                            page_type_value = page_type_info.get("value")
                            page_type_confidence = page_type_info.get("confidence")
                        
                        image_index = page_data.get("pageIndex", 0)
                        
                        # Extract page number information
                        page_number_info = page_data.get("pageNumber", {})
                        page_number_value = None
                        page_number_confidence = None
                        
                        if isinstance(page_number_info, dict):
                            page_number_value = page_number_info.get("value")
                            page_number_confidence = page_number_info.get("confidence")
                        
                        try:
                            await crud_image.save_image_file(
                                raw_input=raw_image_data, 
                                image_name=image_name, 
                                collection_id=collection_id, 
                                image_id=image_id,
                                order=image_index, 
                                db=db,
                                parent_meta_element_id=parent_meta_element_id,
                                page_type=page_type_value,
                                page_type_confidence=page_type_confidence,
                                page_index=page_number_value,
                                page_index_confidence=page_number_confidence
                            )
                            
                            logger.info(f"Added image {image_id} to session")
                            image_id_map[str(image_id)] = image_id
                            success_counters["images"] += 1
                        except Exception as e:
                            logger.warning(f"Failed to save image {image_id}: {str(e)}")
                    except Exception as e:
                        logger.warning(f"Failed to process image {image_id}: {str(e)}")
            except Exception as e:
                logger.warning(f"Failed to process page/image {page_data.get('id')}: {e}")
    
    try:
        await db.commit()
        logger.info("Committed images to database")
    except Exception as e:
        logger.error(f"Failed to commit images: {str(e)}")
        image_id_map = {}
    
    images_verified = 0
    images_failed = 0
    
    async with db.begin():
        logger.info(f"Verifying {len(image_id_map)} images...")
        for image_id in list(image_id_map.values()):
            try:
                image_check = await db.execute(
                    select(model.Image).filter(model.Image.id == image_id)
                )
                if image_check.unique().scalar_one_or_none():
                    images_verified += 1
                else:
                    logger.warning(f"Verification failed for image {image_id} - removing from map")
                    keys_to_remove = [k for k, v in image_id_map.items() if v == image_id]
                    for k in keys_to_remove:
                        image_id_map.pop(k, None)
                    images_failed += 1
            except Exception as e:
                logger.warning(f"Error verifying image {image_id}: {str(e)}")
                images_failed += 1
    
    verification_rate = (images_verified / (images_verified + images_failed) * 100) if (images_verified + images_failed) > 0 else 0
    logger.info(f"Image verification: {images_verified} verified, {images_failed} failed ({verification_rate:.1f}%)")
    
    return image_id_map


async def _process_detections(db: AsyncSession, metakat_data: dict, collection_id: UUID, image_id_map: dict, success_counters: dict):
    """Process all detections, linking them to images and meta elements"""
    logger.info("PHASE 3: Processing detections...")
    
    regular_detections = metakat_data.get("detections", [])
    
    verification_stats = {
        "total_detections": len(regular_detections),
        "success": 0,
        "failed": 0
    }
    
    if verification_stats["total_detections"] == 0:
        logger.info("No detections to process")
        return verification_stats
    
    logger.info(f"Processing {len(regular_detections)} detections")
    
    # Process regular detections
    try:
        async with db.begin():
            meta_roles_query = await db.execute(select(model.MetaRole))
            meta_roles = meta_roles_query.unique().scalars().all()
            
            meta_roles_by_name = {}
            for role in meta_roles:
                if hasattr(role, 'computed_name'):
                    meta_roles_by_name[role.computed_name] = role.id
            
            logger.info(f"Found {len(meta_roles_by_name)} meta roles for classification")
            
            # Process regular detections
            for detection in regular_detections:
                try:
                    detection_dict = detection.copy()
                    detection_id = UUID(detection_dict.get("id"))
                    
                    detection_check = await db.execute(
                        select(model.Detection).filter(model.Detection.id == detection_id)
                    )
                    if detection_check.unique().scalar_one_or_none():
                        logger.info(f"Detection already exists: {detection_id}")
                        success_counters["detections"] += 1
                        verification_stats["success"] += 1
                        continue
                    
                    image_id = detection_dict.get("page_id") or detection_dict.get("image_id")
                    
                    if not image_id:
                        logger.warning(f"No image found for detection: {detection_id}, skipping")
                        verification_stats["failed"] += 1
                        continue
                    
                    image_check = await db.execute(
                        select(model.Image).filter(model.Image.id == image_id)
                    )
                    db_image = image_check.unique().scalar_one_or_none()
                    
                    if not db_image:
                        logger.warning(f"No image found for detection: {detection_id}, skipping")
                        verification_stats["failed"] += 1
                        continue
                    else:
                        logger.info(f"Found image {image_id} for detection {detection_id}")
                        mapped_image_id = image_id
                    
                    detection_obj = base_objects.DetectionNew(
                        id=detection_id,
                        image_id=str(mapped_image_id),
                        bbox=detection_dict.get("bbox"),
                        value=detection_dict.get("value"),
                        confidence=detection_dict.get("confidence")
                    )
                    
                    db_detection = model.Detection(**detection_obj.model_dump())
                    db.add(db_detection)
                    success_counters["detections"] += 1
                    verification_stats["success"] += 1
                    logger.info(f"Created detection: {detection_id}")
                    
                    meta_element_id = detection_dict.get("parent_element_id")
                    meta_element_type = detection_dict.get("element_type")
                    meta_attribute_type = detection_dict.get("meta_attribute_type")
                    
                    if not meta_element_id or not meta_element_type or not meta_attribute_type:
                        logger.warning(f"Missing metadata for detection {detection_id}")
                        continue
                    
                    computed_name = f"{meta_element_type}.{meta_attribute_type}"
                    meta_role_id = meta_roles_by_name.get(computed_name)
                    if not meta_role_id:
                        logger.warning(f"No meta role found for {computed_name}")
                        continue
                    
                    meta_element_detection = base_objects.MetaElementDetectionNew(
                        id=uuid.uuid4(),
                        detection_id=detection_id,
                        meta_element_id=meta_element_id,
                        meta_role_id=meta_role_id
                    )
                    
                    db_meta_element_detection = model.MetaElementDetection(**meta_element_detection.model_dump())
                    db.add(db_meta_element_detection)  
                    success_counters["meta_element_detections"] += 1
                    logger.info(f"Created meta element detection for {computed_name}")
                    
                except Exception as e:
                    detection_id = detection.get("id", "unknown")
                    logger.warning(f"Failed to process detection {detection_id}: {e}")
                    verification_stats["failed"] += 1
    except Exception as e:
        logger.error(f"Error processing detections: {e}")
        verification_stats["failed"] += len(regular_detections)
    
    return verification_stats


async def get_collection_hierarchical(db: AsyncSession, collection_id: UUID):
    """Get a collection with all its images and meta_elements explicitly loaded in a hierarchical structure"""
    try:
        # Get the collection with basic information
        async with db.begin():
            collection_query = await db.execute(
                select(model.Collection)
                .where(model.Collection.id == collection_id)
            )
            db_collection = collection_query.unique().scalar_one_or_none()
            
            if not db_collection:
                return None
            
            # Break down the query into simpler parts to avoid SQL aliasing issues
            
            # First, get all meta elements for this collection
            meta_elements_query = await db.execute(
                select(model.MetaElement)
                .where(model.MetaElement.collection_id == collection_id)
            )
            db_meta_elements = meta_elements_query.unique().scalars().all()
            
            # Get all meta element types in a single query
            meta_element_types_query = await db.execute(
                select(model.MetaElementType)
            )
            db_meta_element_types = meta_element_types_query.unique().scalars().all()
            
            # Create a mapping of meta element types by ID for quick lookup
            meta_element_types_by_id = {str(met.id): met for met in db_meta_element_types}
            
            # Get all meta roles in a single query
            meta_roles_query = await db.execute(
                select(model.MetaRole)
            )
            db_meta_roles = meta_roles_query.unique().scalars().all()
            
            # Create a mapping of meta roles by ID for quick lookup
            meta_roles_by_id = {str(mr.id): mr for mr in db_meta_roles}
            
            # First pass: Create all meta elements without relationships
            meta_elements_by_id = {}
            root_elements = []
            
            for element in db_meta_elements:
                # Convert to Pydantic model
                meta_element_dict = model.orm2dict(element)
                
                # Initialize with empty lists for relationships
                meta_element_dict["detections"] = []
                meta_element_dict["children"] = []
                meta_element_dict["images"] = []
                
                # Add meta_element_type relationship
                if element.meta_element_type_id and str(element.meta_element_type_id) in meta_element_types_by_id:
                    meta_element_type = meta_element_types_by_id[str(element.meta_element_type_id)]
                    meta_element_dict["meta_element_type"] = base_objects.MetaElementType(
                        **model.orm2dict(meta_element_type)
                    )
                
                # Create MetaElementHierarchical object
                meta_element = MetaElementHierarchical(**meta_element_dict)
                meta_elements_by_id[str(element.id)] = meta_element
                
                # Collect root elements for later
                if not element.parent_id:
                    root_elements.append(meta_element)
            
            # Second pass: Build parent-child relationships
            for element in db_meta_elements:
                if element.parent_id:
                    # Get the parent ID as string for lookup
                    parent_id_str = str(element.parent_id)
                    child_id_str = str(element.id)
                    
                    # Only proceed if both parent and child exist in our map
                    if parent_id_str in meta_elements_by_id and child_id_str in meta_elements_by_id:
                        parent = meta_elements_by_id[parent_id_str]
                        child = meta_elements_by_id[child_id_str]
                        
                        # Append child to parent's children
                        parent.children.append(child)
                    else:
                        logger.warning(f"Parent-child relationship not found: parent_id={parent_id_str}, child_id={child_id_str}")
            
            # For each meta element, get its images
            for element_id, element in meta_elements_by_id.items():
                images_query = await db.execute(
                    select(model.Image)
                    .where(model.Image.parent_meta_element_id == UUID(element_id))
                )
                db_images = images_query.unique().scalars().all()
                
                for image in db_images:
                    image_dict = model.orm2dict(image)
                    image_obj = base_objects.Image(**image_dict)
                    element.images.append(image_obj)
            
            # For each meta element, get its meta element detections and associated detections
            for element_id, element in meta_elements_by_id.items():
                # Get meta element detections
                meta_element_detections_query = await db.execute(
                    select(model.MetaElementDetection)
                    .where(model.MetaElementDetection.meta_element_id == UUID(element_id))
                )
                db_meta_element_detections = meta_element_detections_query.unique().scalars().all()
                
                # For each meta element detection, get the associated detection
                for med in db_meta_element_detections:
                    detection_query = await db.execute(
                        select(model.Detection)
                        .where(model.Detection.id == med.detection_id)
                    )
                    db_detection = detection_query.unique().scalar_one_or_none()
                    
                    if db_detection:
                        # Check if this detection is already processed
                        detection_exists = any(d.id == db_detection.id for d in element.detections)
                        
                        if not detection_exists:
                            detection_dict = model.orm2dict(db_detection)
                            
                            # Create the meta_element_detection link with meta_role
                            meta_element_detection_dict = model.orm2dict(med)
                            
                            # Add meta_role to meta_element_detection if it exists
                            if med.meta_role_id and str(med.meta_role_id) in meta_roles_by_id:
                                meta_role = meta_roles_by_id[str(med.meta_role_id)]
                                meta_element_detection_dict["meta_role"] = base_objects.MetaRole(
                                    **model.orm2dict(meta_role)
                                )
                            
                            meta_element_detection = base_objects.MetaElementDetection(**meta_element_detection_dict)
                            
                            # Create DetectionHierarchical object with a single meta_element_detection
                            detection_dict["meta_element_detections"] = meta_element_detection
                            detection_obj = DetectionHierarchical(**detection_dict)
                            
                            # Add to element's detections
                            element.detections.append(detection_obj)
            
            # Check if we have any root elements
            if not root_elements:
                logger.warning(f"No root elements found for collection {collection_id}")
                return None
                
            # If multiple root elements, select the first one
            root_element = root_elements[0]
            if len(root_elements) > 1:
                logger.warning(f"Multiple root elements found for collection {collection_id}, using the first one")
                
            # Create the final hierarchical collection with a single global_structure
            collection_dict = model.orm2dict(db_collection)
            collection_dict["global_structure"] = root_element
            
            # Add debug information
            logger.info(f"Root element ID: {root_element.id}")
            logger.info(f"Root element has {len(root_element.children)} children")
            for i, child in enumerate(root_element.children):
                logger.info(f"  Child {i+1} ID: {child.id}, has {len(child.children)} children")
            
            return CollectionHierarchical(**collection_dict)
            
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading hierarchical collection from database")
        raise DBError(f"Failed reading hierarchical collection from database") from e
    
    
    