import logging
import os
import random
import shutil
import uuid
import zipfile
import asyncio
import json
from typing import Dict, List
from uuid import UUID
from datetime import datetime

import aiofiles
from aiofiles import os as aiofiles_os
from fastapi import UploadFile, HTTPException
from sqlalchemy import exc, select, update, delete, text
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
            # Use plain select without any joinedload options
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

        # YOLO imports typically don't have meta elements with title/volume hierarchies
        # But we'll check if any exist that we should set as root
        try:
            from metacheck.constants import META_ELEMENT_TYPE_IDS
            
            # Look for title or volume elements first
            title_id = None
            volume_id = None
            
            # Check for title elements
            title_type_id = META_ELEMENT_TYPE_IDS.get('title')
            if title_type_id:
                async with db.begin():
                    title_query = await db.execute(
                        select(model.MetaElement)
                        .where(
                            model.MetaElement.collection_id == collection_id,
                            model.MetaElement.meta_element_type_id == title_type_id,
                            model.MetaElement.parent_id == None
                        )
                    )
                    title_element = title_query.unique().scalar_one_or_none()
                    if title_element:
                        title_id = title_element.id
                        logger.info(f"Found title element {title_id} to use as root")
            
            # Check for volume elements
            volume_type_id = META_ELEMENT_TYPE_IDS.get('volume')
            if volume_type_id and not title_id:
                async with db.begin():
                    volume_query = await db.execute(
                        select(model.MetaElement)
                        .where(
                            model.MetaElement.collection_id == collection_id,
                            model.MetaElement.meta_element_type_id == volume_type_id,
                            model.MetaElement.parent_id == None
                        )
                    )
                    volume_element = volume_query.unique().scalar_one_or_none()
                    if volume_element:
                        volume_id = volume_element.id
                        logger.info(f"Found volume element {volume_id} to use as root")
            
            # Set the root element if we found a suitable one
            if title_id or volume_id:
                root_id = title_id or volume_id
                await find_and_set_root_meta_element(db, collection_id, title_id, volume_id)
                logger.info(f"Set root element to {root_id} for YOLO collection {collection_id}")
            else:
                logger.info(f"No suitable root element found for YOLO collection {collection_id}")
        except Exception as e:
            logger.warning(f"Failed to check for root elements in YOLO import: {str(e)}")
            
        # Delete extracted folder
        shutil.rmtree(extracted_dir_path)
        return {"message": "YOLO collection imported successfully", "collection_id": str(collection_id)}

    except Exception as e:
        logger.exception(f"Failed to process file. Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process the file.")


async def invalidate_collection_cache(db: AsyncSession, collection_id: UUID):
    """Invalidate the hierarchical structure cache for a collection"""
    try:
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        
        if is_transaction_active:
            # If transaction is active, just run the query
            await db.execute(
                update(model.Collection)
                .where(model.Collection.id == collection_id)
                .values(hierarchical_structure=None)
            )
        else:
            # If no transaction is active, start one
            async with db.begin():
                await db.execute(
                    update(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .values(hierarchical_structure=None)
                )
        
        logger.info(f"Invalidated hierarchical structure cache for collection {collection_id}")
    except exc.SQLAlchemyError as e:
        # Just log the error but don't raise an exception
        # This is a non-critical operation
        logger.warning(f"Failed to invalidate cache for collection {collection_id}: {str(e)}")


async def get_collection_hierarchical(db: AsyncSession, collection_id: UUID, use_cache: bool = True):
    """Get a collection with all its images and meta_elements explicitly loaded in a hierarchical structure"""
    start_time = datetime.now()
    logger.info(f"[CACHE] Starting hierarchy fetch for collection {collection_id}")
    
    try:
        # Check for cached structure first
        if use_cache:
            logger.info(f"[CACHE] Cache enabled, checking for existing cache")
            collection_query = await db.execute(
                select(model.Collection)
                .where(model.Collection.id == collection_id)
            )
            db_collection = collection_query.unique().scalar_one_or_none()
            
            # Debug check for cache field
            logger.debug(f"[CACHE] Collection found, hierarchical_structure is {type(db_collection.hierarchical_structure) if db_collection and hasattr(db_collection, 'hierarchical_structure') else 'None or not present'}")
            
            if db_collection and db_collection.hierarchical_structure:
                cache_time = datetime.now() - start_time
                logger.info(f"[CACHE] ✅ Cache hit for collection {collection_id} | Retrieved in {cache_time.total_seconds():.4f}s")
                return CollectionHierarchical(**db_collection.hierarchical_structure)
            else:
                logger.info(f"[CACHE] ❌ Cache miss for collection {collection_id}")
        else:
            logger.info(f"[CACHE] Cache disabled for this request")
        
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        logger.debug(f"[CACHE] Transaction active: {is_transaction_active}")
        
        # Get the collection with the root meta element joined
        if is_transaction_active:
            # If transaction is active, just run the query
            collection_query = await db.execute(
                select(model.Collection)
                .where(model.Collection.id == collection_id)
                .options(joinedload(model.Collection.root_meta_element))
            )
        else:
            # If no transaction is active, start one
            async with db.begin():
                collection_query = await db.execute(
                    select(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .options(joinedload(model.Collection.root_meta_element))
                )
        
        db_collection = collection_query.unique().scalar_one_or_none()
        
        if not db_collection:
            logger.warning(f"[CACHE] Collection {collection_id} not found")
            raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
        
        # Create the collection object without the hierarchical structure first
        collection_dict = model.orm2dict(db_collection)
        
        # Check if we have a root meta element
        root_element_id = db_collection.root_meta_element_id
        if not root_element_id:
            logger.warning(f"[CACHE] No root meta element set for collection {collection_id}")
            # Return the collection without the hierarchical structure
            collection_dict["global_structure"] = None
            return CollectionHierarchical(**collection_dict)
        
        logger.info(f"[CACHE] Building hierarchy for collection {collection_id} | Root element: {root_element_id}")
        build_start_time = datetime.now()
        
        # Build the hierarchical structure starting from the root
        root_element = await build_meta_element_hierarchy_optimized(db, root_element_id)
        if not root_element:
            logger.warning(f"[CACHE] Failed to build hierarchy using optimized method for root element {root_element_id}")
            # Try with the original, simpler implementation as a fallback
            logger.info(f"[CACHE] Trying fallback hierarchy builder for root element {root_element_id}")
            root_element = await build_meta_element_hierarchy(db, root_element_id)
            
            if not root_element:
                # If both methods fail, return the collection without the hierarchical structure
                logger.error(f"[CACHE] Both hierarchy builders failed for collection {collection_id}")
                collection_dict["global_structure"] = None
                return CollectionHierarchical(**collection_dict)
        
        build_time = datetime.now() - build_start_time
        logger.info(f"[CACHE] Hierarchy built successfully in {build_time.total_seconds():.4f}s")
        
        # Add the hierarchical structure to the collection
        collection_dict["global_structure"] = root_element
        
        # Debug information
        logger.info(f"[CACHE] Root element ID: {root_element.id}")
        logger.info(f"[CACHE] Root element has {len(root_element.children)} children")
        
        # Store the structure in the cache if caching is enabled
        if use_cache:
            try:
                cache_start_time = datetime.now()
                logger.info(f"[CACHE] Preparing to update cache for collection {collection_id}")
                
                # Create the full result object
                result = CollectionHierarchical(**collection_dict)
                
                # Convert to a JSON-serializable dict with UUIDs as strings and datetimes as ISO format
                def convert_to_json_safe(obj):
                    if isinstance(obj, dict):
                        return {k: convert_to_json_safe(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [convert_to_json_safe(i) for i in obj]
                    elif isinstance(obj, UUID):
                        return str(obj)
                    elif isinstance(obj, datetime):
                        return obj.isoformat()
                    else:
                        return obj
                
                # Get model dict and convert UUIDs to strings for JSON serialization
                json_safe_dict = convert_to_json_safe(result.model_dump())
                
                # For debugging, check the size of the cache and save a sample
                json_size = len(json.dumps(json_safe_dict))
                logger.info(f"[CACHE] Cache size: {json_size / 1024:.2f} KB")
                
                # For debugging, log a small portion of the cache
                logger.debug(f"[CACHE] Cache sample (first few keys): {list(json_safe_dict.keys())}")
                
                # IMPORTANT: Create a separate database session for the cache update
                # This avoids issues with nested transactions
                from metacheck.database import get_async_session
                
                # Use next() with the generator function
                async_session_gen = get_async_session()
                async_db = await anext(async_session_gen)
                
                try:
                    # Execute the update in its own transaction
                    async with async_db.begin():
                        logger.debug(f"[CACHE] Starting dedicated transaction for cache update")
                        query = (
                            update(model.Collection)
                            .where(model.Collection.id == collection_id)
                            .values(hierarchical_structure=json_safe_dict)
                        )
                        update_result = await async_db.execute(query)
                        rows_affected = update_result.rowcount
                        logger.debug(f"[CACHE] Update query executed, affected {rows_affected} rows")
                        
                    # Verify the cache was updated
                    verification_query = await async_db.execute(
                        select(model.Collection.hierarchical_structure)
                        .where(model.Collection.id == collection_id)
                    )
                    verification_result = verification_query.scalar_one_or_none()
                    cache_updated = verification_result is not None
                    
                    if cache_updated:
                        cache_time = datetime.now() - cache_start_time
                        logger.info(f"[CACHE] ✅ Successfully updated cache in {cache_time.total_seconds():.4f}s")
                    else:
                        logger.error(f"[CACHE] ❌ Cache update failed - verification found no data")
                except Exception as inner_e:
                    logger.error(f"[CACHE] ❌ Database error during cache update: {str(inner_e)}", exc_info=True)
                finally:
                    # Close the dedicated session
                    await async_db.close()
                    
            except Exception as e:
                logger.error(f"[CACHE] ❌ Failed to update cache: {str(e)}", exc_info=True)
                # Continue without caching - don't block the response
        
        total_time = datetime.now() - start_time
        logger.info(f"[CACHE] Total fetch time for collection {collection_id}: {total_time.total_seconds():.4f}s")
        return CollectionHierarchical(**collection_dict)
            
    except HTTPException:
        # Re-raise HTTP exceptions
        logger.warning(f"[CACHE] HTTP exception while fetching collection {collection_id}")
        raise
    except Exception as e:
        total_time = datetime.now() - start_time
        logger.exception(f"[CACHE] ❌ Failed fetching collection {collection_id} after {total_time.total_seconds():.4f}s: {str(e)}")
        raise DBError(f"Failed reading hierarchical collection from database: {str(e)}") from e


async def build_meta_element_hierarchy_optimized(db: AsyncSession, meta_element_id: UUID, max_depth: int = 10, current_depth: int = 0):
    """Optimized version of build_meta_element_hierarchy that reduces the N+1 query problem.
    
    This implementation uses bulk loading of related data and temporary dictionaries to
    reduce the number of database queries.
    """
    if current_depth > max_depth:
        logger.warning(f"Reached maximum recursion depth of {max_depth} for meta element {meta_element_id}")
        return None
    
    try:
        # Get the meta element tree using a more efficient approach
        # Progress tracking: 1/5 - Getting root element
        logger.info(f"[PROGRESS] (1/5) Getting root meta element {meta_element_id}...")
        
        # First, get the target meta element
        root_query = await db.execute(
            select(model.MetaElement)
            .options(joinedload(model.MetaElement.meta_element_type))
            .where(model.MetaElement.id == meta_element_id)
        )
        root_element = root_query.unique().scalar_one_or_none()
        
        if not root_element:
            logger.warning(f"Meta element {meta_element_id} not found")
            return None
            
        # Get the collection ID to filter all related meta elements
        collection_id = root_element.collection_id
        
        # Progress tracking: 2/5 - Loading all meta elements
        logger.info(f"[PROGRESS] (2/5) Loading all meta elements for collection {collection_id}...")
        
        # Get all meta elements for this collection
        all_elements_query = await db.execute(
            select(model.MetaElement)
            .options(joinedload(model.MetaElement.meta_element_type))
            .where(model.MetaElement.collection_id == collection_id)
        )
        all_elements = all_elements_query.unique().scalars().all()
        
        logger.info(f"[PROGRESS] (2/5) Loaded {len(all_elements)} meta elements")
        
        # Create a dictionary of meta element IDs to their MetaElementHierarchical objects
        meta_elements_dict = {}
        meta_element_ids = []
        
        for element in all_elements:
            meta_element_dict = model.orm2dict(element)
            meta_element_dict["children"] = []
            meta_element_dict["images"] = []
            meta_element_dict["detections"] = []
            
            # Add meta_element_type if available
            if element.meta_element_type:
                meta_element_dict["meta_element_type"] = base_objects.MetaElementType(
                    **model.orm2dict(element.meta_element_type)
                )
            
            meta_elements_dict[str(element.id)] = MetaElementHierarchical(**meta_element_dict)
            meta_element_ids.append(str(element.id))
        
        # Progress tracking: 3/5 - Building tree structure
        logger.info(f"[PROGRESS] (3/5) Building tree structure with {len(meta_element_ids)} elements...")
        
        # Build the tree structure by adding children
        child_count = 0
        for element in all_elements:
            if element.parent_id and str(element.parent_id) in meta_elements_dict and str(element.id) in meta_elements_dict:
                parent = meta_elements_dict[str(element.parent_id)]
                child = meta_elements_dict[str(element.id)]
                parent.children.append(child)
                child_count += 1
        
        logger.info(f"[PROGRESS] (3/5) Tree structure built with {child_count} parent-child relationships")
        
        # Progress tracking: 4/5 - Loading images
        logger.info(f"[PROGRESS] (4/5) Loading images for meta elements...")
        
        # Get all images for all meta elements in one query
        images_query = await db.execute(
            select(model.Image)
            .where(model.Image.parent_meta_element_id.in_(meta_element_ids))
        )
        images = images_query.scalars().all()
        
        logger.info(f"[PROGRESS] (4/5) Loaded {len(images)} images")
        
        # Assign images to their parent meta elements
        image_count = 0
        for image in images:
            if image.parent_meta_element_id and str(image.parent_meta_element_id) in meta_elements_dict:
                image_dict = model.orm2dict(image)
                meta_elements_dict[str(image.parent_meta_element_id)].images.append(
                    base_objects.Image(**image_dict)
                )
                image_count += 1
        
        logger.info(f"[PROGRESS] (4/5) Assigned {image_count} images to meta elements")
        
        # Progress tracking: 5/5 - Loading detections
        logger.info(f"[PROGRESS] (5/5) Loading detections for meta elements...")
        
        # Get all meta element detections and their meta roles in one query
        if meta_element_ids:  # Only query if we have meta element IDs
            med_query = await db.execute(
                select(model.MetaElementDetection)
                .options(joinedload(model.MetaElementDetection.meta_role))
                .where(model.MetaElementDetection.meta_element_id.in_(meta_element_ids))
            )
            med_list = med_query.unique().scalars().all()
            
            logger.info(f"[PROGRESS] (5/5) Loaded {len(med_list)} meta element detections")
            
            # Group detections by meta element ID
            med_by_meta_element = {}
            detection_ids = []
            
            for med in med_list:
                med_by_meta_element.setdefault(str(med.meta_element_id), []).append(med)
                detection_ids.append(str(med.detection_id))
            
            # Get all detections in one query
            if detection_ids:  # Only query if we have detection IDs
                logger.info(f"[PROGRESS] (5/5) Loading {len(detection_ids)} detections...")
                detections_query = await db.execute(
                    select(model.Detection)
                    .where(model.Detection.id.in_(detection_ids))
                )
                detections = {
                    str(d.id): d
                    for d in detections_query.scalars().all()
                }
                
                logger.info(f"[PROGRESS] (5/5) Loaded {len(detections)} detections")
                
                # Assign detections to their meta elements
                detection_count = 0
                for meta_element_id_str, meds in med_by_meta_element.items():
                    if meta_element_id_str in meta_elements_dict:
                        meta_element = meta_elements_dict[meta_element_id_str]
                        
                        for med in meds:
                            detection_id_str = str(med.detection_id)
                            if detection_id_str in detections:
                                detection = detections[detection_id_str]
                                detection_dict = model.orm2dict(detection)
                                
                                # Create meta element detection with meta role
                                med_dict = model.orm2dict(med)
                                if med.meta_role:
                                    med_dict["meta_role"] = base_objects.MetaRole(**model.orm2dict(med.meta_role))
                                
                                med_obj = base_objects.MetaElementDetection(**med_dict)
                                
                                # Create detection with meta element detection
                                detection_dict["meta_element_detections"] = med_obj
                                detection_obj = DetectionHierarchical(**detection_dict)
                                
                                meta_element.detections.append(detection_obj)
                                detection_count += 1
                
                logger.info(f"[PROGRESS] (5/5) Assigned {detection_count} detections to meta elements")
            else:
                logger.info(f"[PROGRESS] (5/5) No detections to load")
        else:
            logger.info(f"[PROGRESS] (5/5) No meta elements to load detections for")
        
        # Progress tracking: completed
        logger.info(f"[PROGRESS] Hierarchy build completed successfully!")
        
        # Return the root element
        return meta_elements_dict.get(str(meta_element_id))
    
    except Exception as e:
        logger.exception(f"Error building meta element hierarchy: {str(e)}")
        return None


# Add a new endpoint for lazily loading additional data
async def get_meta_element_children(
    db: AsyncSession,
    meta_element_id: UUID,
    limit: int = 20,
    offset: int = 0
):
    """Get children for a specific meta element with pagination"""
    try:
        # Get children with pagination
        children_query = await db.execute(
            select(model.MetaElement)
            .options(joinedload(model.MetaElement.meta_element_type))
            .where(model.MetaElement.parent_id == meta_element_id)
            .order_by(model.MetaElement.id)
            .offset(offset)
            .limit(limit)
        )
        db_children = children_query.unique().scalars().all()
        
        # Create result objects
        children = []
        for child in db_children:
            child_dict = model.orm2dict(child)
            child_dict["children"] = [] 
            child_dict["images"] = []
            child_dict["detections"] = []
            
            # Add meta_element_type
            if child.meta_element_type:
                child_dict["meta_element_type"] = base_objects.MetaElementType(
                    **model.orm2dict(child.meta_element_type)
                )
            
            children.append(MetaElementHierarchical(**child_dict))
            
        return children
    
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading meta element children from database")
        raise DBError(f"Failed reading meta element children from database") from e


# Add a new endpoint for lazily loading images
async def get_meta_element_images(
    db: AsyncSession,
    meta_element_id: UUID,
    limit: int = 20,
    offset: int = 0
):
    """Get images for a specific meta element with pagination"""
    try:
        # Get images with pagination
        images_query = await db.execute(
            select(model.Image)
            .where(model.Image.parent_meta_element_id == meta_element_id)
            .order_by(model.Image.order)
            .offset(offset)
            .limit(limit)
        )
        db_images = images_query.unique().scalars().all()
        
        # Create result objects
        images = []
        for image in db_images:
            image_dict = model.orm2dict(image)
            images.append(base_objects.Image(**image_dict))
            
        return images
    
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading meta element images from database")
        raise DBError(f"Failed reading meta element images from database") from e


# Add a new endpoint for lazily loading detections
async def get_meta_element_detections(
    db: AsyncSession,
    meta_element_id: UUID,
    limit: int = 20,
    offset: int = 0
):
    """Get detections for a specific meta element with pagination"""
    try:
        # Load meta roles for the operation
        meta_roles_query = await db.execute(select(model.MetaRole))
        db_meta_roles = meta_roles_query.unique().scalars().all()
        meta_roles_by_id = {str(mr.id): base_objects.MetaRole(**model.orm2dict(mr)) for mr in db_meta_roles}
        
        # Get detections with pagination using JOIN
        joined_query = await db.execute(
            select(
                model.MetaElementDetection, 
                model.Detection
            )
            .join(
                model.Detection, 
                model.MetaElementDetection.detection_id == model.Detection.id
            )
            .where(model.MetaElementDetection.meta_element_id == meta_element_id)
            .order_by(model.Detection.id)
            .offset(offset)
            .limit(limit)
        )
        results = joined_query.unique().all()
        
        # Create result objects
        detections = []
        for med, detection in results:
            # Create detection dictionary
            detection_dict = model.orm2dict(detection)
            
            # Create meta_element_detection with meta_role
            med_dict = model.orm2dict(med)
            if med.meta_role_id:
                meta_role_id_str = str(med.meta_role_id)
                if meta_role_id_str in meta_roles_by_id:
                    med_dict["meta_role"] = meta_roles_by_id[meta_role_id_str]
            
            # Create detection object with meta_element_detection
            detection_dict["meta_element_detections"] = base_objects.MetaElementDetection(**med_dict)
            detection_obj = DetectionHierarchical(**detection_dict)
            
            # Add to element
            element.detections.append(detection_obj)
            
        return detections
    
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading meta element detections from database")
        raise DBError(f"Failed reading meta element detections from database") from e


async def import_metakat_collection(file: UploadFile, db: AsyncSession):
    """Import a MetaKat formatted dataset - optimized for large batches"""
    from metacheck.cruds import crud_import
    return await crud_import.import_metakat_collection(file, db)


async def build_meta_element_hierarchy(db: AsyncSession, meta_element_id: UUID, max_depth: int = 10, current_depth: int = 0):
    """Recursively build the hierarchy for a meta element.
    
    Args:
        db: Database session
        meta_element_id: ID of the meta element to build hierarchy for
        max_depth: Maximum depth to build (to prevent infinite recursion)
        current_depth: Current depth in the recursion
        
    Returns:
        A MetaElementHierarchical object with children populated
    """
    if current_depth > max_depth:
        logger.warning(f"Reached maximum recursion depth of {max_depth} for meta element {meta_element_id}")
        return None
    
    # Get the meta element with its type
    meta_element_query = await db.execute(
        select(model.MetaElement)
        .options(joinedload(model.MetaElement.meta_element_type))
        .where(model.MetaElement.id == meta_element_id)
    )
    meta_element = meta_element_query.unique().scalar_one_or_none()
    
    if not meta_element:
        logger.warning(f"Meta element {meta_element_id} not found")
        return None
    
    # Create the basic meta element
    meta_element_dict = model.orm2dict(meta_element)
    meta_element_dict["children"] = []
    meta_element_dict["images"] = []
    meta_element_dict["detections"] = []
    
    # Add meta_element_type if available
    if meta_element.meta_element_type:
        meta_element_dict["meta_element_type"] = base_objects.MetaElementType(
            **model.orm2dict(meta_element.meta_element_type)
        )
    
    element = MetaElementHierarchical(**meta_element_dict)
    
    # Get direct children
    children_query = await db.execute(
        select(model.MetaElement)
        .where(model.MetaElement.parent_id == meta_element_id)
    )
    children = children_query.unique().scalars().all()
    
    # Recursively build children
    for child in children:
        child_hier = await build_meta_element_hierarchy(
            db, child.id, max_depth, current_depth + 1
        )
        if child_hier:
            element.children.append(child_hier)
    
    # Get images for this element
    images_query = await db.execute(
        select(model.Image)
        .where(model.Image.parent_meta_element_id == meta_element_id)
    )
    images = images_query.unique().scalars().all()
    
    for image in images:
        image_dict = model.orm2dict(image)
        element.images.append(base_objects.Image(**image_dict))
    
    # Get detections for this meta element
    meta_element_detections_query = await db.execute(
        select(model.MetaElementDetection)
        .options(joinedload(model.MetaElementDetection.meta_role))
        .where(model.MetaElementDetection.meta_element_id == meta_element_id)
    )
    meta_element_detections = meta_element_detections_query.unique().scalars().all()
    
    # For each meta element detection, get the detection
    for med in meta_element_detections:
        detection_query = await db.execute(
            select(model.Detection)
            .where(model.Detection.id == med.detection_id)
        )
        detection = detection_query.unique().scalar_one_or_none()
        
        if detection:
            detection_dict = model.orm2dict(detection)
            
            # Create meta element detection with meta_role
            med_dict = model.orm2dict(med)
            if med.meta_role:
                med_dict["meta_role"] = base_objects.MetaRole(**model.orm2dict(med.meta_role))
                
            med_obj = base_objects.MetaElementDetection(**med_dict)
            
            # Create detection with meta_element_detection
            detection_dict["meta_element_detections"] = med_obj
            detection_obj = DetectionHierarchical(**detection_dict)
            
            element.detections.append(detection_obj)
    
    return element


async def check_hierarchical_cache_status(db: AsyncSession, collection_id: UUID):
    """
    Check and report on the status of the hierarchical cache for a collection.
    
    This is a diagnostic function to help debug caching issues.
    """
    try:
        logger.info(f"[CACHE-CHECK] Checking cache status for collection {collection_id}")
        
        # Get the collection with its hierarchical structure
        collection_query = await db.execute(
            select(model.Collection)
            .where(model.Collection.id == collection_id)
        )
        db_collection = collection_query.unique().scalar_one_or_none()
        
        if not db_collection:
            logger.warning(f"[CACHE-CHECK] Collection {collection_id} not found")
            return {"status": "error", "message": "Collection not found"}
        
        # Check if the column exists in the model
        has_column = hasattr(model.Collection, 'hierarchical_structure')
        logger.info(f"[CACHE-CHECK] Model has hierarchical_structure column: {has_column}")
        
        # Check if hierarchical structure is cached
        has_attribute = hasattr(db_collection, 'hierarchical_structure')
        logger.info(f"[CACHE-CHECK] Instance has hierarchical_structure attribute: {has_attribute}")
        
        # Get value type
        value_type = type(db_collection.hierarchical_structure) if has_attribute else None
        logger.info(f"[CACHE-CHECK] Cache attribute type: {value_type}")
        
        # Check for NULL in the database
        if not has_attribute or db_collection.hierarchical_structure is None:
            logger.info(f"[CACHE-CHECK] No cache exists for collection {collection_id}")
            
            # Check if the column exists in the database
            try:
                # Direct raw query to check column existence
                from sqlalchemy import text
                raw_query = text("SELECT column_name FROM information_schema.columns WHERE table_name = 'collections' AND column_name = 'hierarchical_structure'")
                result = await db.execute(raw_query)
                column_exists = result.scalar_one_or_none() is not None
                logger.info(f"[CACHE-CHECK] Column exists in database: {column_exists}")
            except Exception as schema_e:
                logger.error(f"[CACHE-CHECK] Error checking schema: {str(schema_e)}")
                column_exists = "Unknown (error checking)"
            
            return {
                "status": "missing", 
                "message": "No cache exists",
                "has_column_in_model": has_column,
                "has_attribute_in_instance": has_attribute,
                "column_exists_in_db": column_exists,
                "value_type": str(value_type)
            }
        
        # Get cache details
        cache_data = db_collection.hierarchical_structure
        
        # Calculate size
        try:
            json_dump = json.dumps(cache_data)
            cache_size_bytes = len(json_dump)
            cache_size_kb = cache_size_bytes / 1024
            
            # Log cache structure details
            logger.info(f"[CACHE-CHECK] Cache exists for collection {collection_id}")
            logger.info(f"[CACHE-CHECK] Cache size: {cache_size_kb:.2f} KB")
            
            # Check for global_structure
            has_global_structure = "global_structure" in cache_data
            logger.info(f"[CACHE-CHECK] Has global_structure: {has_global_structure}")
            
            # Debug: log all top-level keys
            logger.info(f"[CACHE-CHECK] Top-level keys: {list(cache_data.keys())}")
            
            # Check for basic required fields
            required_fields = ["id", "name", "created_date", "last_change", "last_access"]
            missing_fields = [field for field in required_fields if field not in cache_data]
            
            if missing_fields:
                logger.warning(f"[CACHE-CHECK] Missing required fields in cache: {missing_fields}")
            else:
                logger.info(f"[CACHE-CHECK] All required fields present in cache")
            
            # If global_structure exists, check its depth
            max_depth = 0
            child_counts = []
            
            if has_global_structure and cache_data["global_structure"]:
                # Function to recursively check hierarchy depth
                def check_depth(element, current_depth=0):
                    nonlocal max_depth, child_counts
                    if current_depth > max_depth:
                        max_depth = current_depth
                    
                    children = element.get("children", [])
                    child_count = len(children)
                    child_counts.append(child_count)
                    
                    for child in children:
                        check_depth(child, current_depth + 1)
                
                # Start depth check from root
                check_depth(cache_data["global_structure"])
                
                logger.info(f"[CACHE-CHECK] Max hierarchy depth: {max_depth}")
                logger.info(f"[CACHE-CHECK] Average children per node: {sum(child_counts)/len(child_counts) if child_counts else 0:.2f}")
                logger.info(f"[CACHE-CHECK] Max children at any node: {max(child_counts) if child_counts else 0}")
            
            return {
                "status": "valid" if has_global_structure else "incomplete",
                "size_kb": cache_size_kb,
                "has_global_structure": has_global_structure,
                "max_depth": max_depth,
                "missing_fields": missing_fields,
                "top_level_keys": list(cache_data.keys()),
                "has_column_in_model": has_column,
                "has_attribute_in_instance": has_attribute,
                "value_type": str(value_type),
                "message": "Cache valid and complete" if has_global_structure and not missing_fields else "Cache exists but may be incomplete"
            }
        except Exception as json_e:
            logger.error(f"[CACHE-CHECK] Error processing cache JSON: {str(json_e)}")
            return {
                "status": "error", 
                "message": f"Cache exists but cannot be processed: {str(json_e)}",
                "has_column_in_model": has_column,
                "has_attribute_in_instance": has_attribute,
                "value_type": str(value_type),
                "raw_data_sample": str(cache_data)[:200] + "..." if len(str(cache_data)) > 200 else str(cache_data)
            }
        
    except Exception as e:
        logger.exception(f"[CACHE-CHECK] Error checking cache status: {str(e)}")
        return {"status": "error", "message": f"Error checking cache: {str(e)}"}