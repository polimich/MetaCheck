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
from sqlalchemy.orm import joinedload, selectinload

from db import model
from metacheck.constants import META_ELEMENT_TYPE_IDS, ElementTypeEnum
from metacheck.database import DBError
from metacheck.schemas import base_objects
from metacheck.schemas.base_objects.collection import CollectionHierarchical, DetectionHierarchical, MetaElementHierarchical, ImageHierarchical
from metacheck_common.config import config
from metacheck.schemas.metakat_object import (
    MetaKatImport, ElementType, Detection as MetaKatDetection, 
    PageTypeDetection, TitleElement, VolumeElement, IssueElement, 
    PageElement, SupplementElement, ChapterElement, ArticleElement
)

logger = logging.getLogger(__name__)


async def get_collection(
    db: AsyncSession, collection_id: UUID
) -> base_objects.Collection:
    """Retrieve a single collection by its ID."""
    try:
        from metacheck.cruds import crud_general
        return await crud_general.get(db, base_objects.Collection, model.Collection, collection_id)
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading collection from database")
        raise DBError(f"Failed reading collection from database") from e


async def check_preview_and_set(db: AsyncSession, collection_id: UUID, image_id: UUID):
    """
    Checks if the collection's preview image is null and sets it to the given image_id if it is.
    This operation is non-critical and errors are logged but not raised.
    """
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
    """Internal function to check and set preview within a transaction."""
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
    """Retrieve all collections from the database."""
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
    """Delete a collection and all associated images and data."""
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
    """Retrieve all images belonging to a specific collection."""
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
    """Generates and ensures the existence of the directory for ZIP imports for a collection."""
    path = os.path.join(await get_collection_path(collection_id), "zip")
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def get_collection_path(collection_id: UUID):
    """Generates and ensures the existence of the base directory for a collection."""
    path = os.path.join(config.IMAGE_UPLOADED_DIR, str(collection_id))
    await aiofiles_os.makedirs(path, exist_ok=True)
    return path


async def import_yolo_collection(file: UploadFile, db: AsyncSession):
    """
    Import a YOLO formatted dataset from a zip file.
    Creates a new collection, extracts images and annotations, and processes them.
    """
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

    """Invalidate the hierarchical structure cache for a collection"""
    try:
        # Log that we're invalidating the cache
        logger.info(f"Invalidating hierarchical structure cache for collection {collection_id}")
        
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
        
        logger.info(f"Successfully invalidated hierarchical structure cache for collection {collection_id}")
    except exc.SQLAlchemyError as e:
        # Just log the error but don't raise an exception
        # This is a non-critical operation
        logger.warning(f"Failed to invalidate cache for collection {collection_id}: {str(e)}")


async def get_collection_hierarchical(db: AsyncSession, collection_id: UUID, use_cache: bool = False, force_rebuild: bool = True):
    """
    Get a collection with all its images and meta_elements explicitly loaded in a hierarchical structure.
    Optionally uses or forces rebuild of a cached structure.
    """
    start_time = datetime.now()
    logger.info(f"Starting hierarchy fetch for collection {collection_id}")
    
    try:
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        logger.debug(f"Transaction active: {is_transaction_active}")
        
        # Create a dictionary to hold our collection data
        collection_dict = None
        root_element_id = None
        
        # Get the collection with the root meta element joined within a transaction
        if is_transaction_active:
            # If transaction is active, just run the query and fully process the results
            collection_query = await db.execute(
                select(model.Collection)
                .where(model.Collection.id == collection_id)
                .options(joinedload(model.Collection.root_meta_element))
            )
            db_collection = collection_query.unique().scalar_one_or_none()
            
            if not db_collection:
                logger.warning(f"Collection {collection_id} not found")
                raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
            
            # Process all the attributes we need while still in the transaction
            collection_dict = model.orm2dict(db_collection)
            root_element_id = db_collection.root_meta_element_id
        else:
            # If no transaction is active, start one and fully process the results within it
            async with db.begin():
                collection_query = await db.execute(
                    select(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .options(joinedload(model.Collection.root_meta_element))
                )
                db_collection = collection_query.unique().scalar_one_or_none()
                
                if not db_collection:
                    logger.warning(f"Collection {collection_id} not found")
                    raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
                
                # Process all the attributes we need while still in the transaction
                collection_dict = model.orm2dict(db_collection)
                root_element_id = db_collection.root_meta_element_id
        
        # Check if we have a root meta element
        if not root_element_id:
            logger.warning(f"No root meta element set for collection {collection_id}")
            # Return the collection without the hierarchical structure
            collection_dict["global_structure"] = None
            return CollectionHierarchical(**collection_dict)
        
        logger.info(f"Building hierarchy for collection {collection_id} | Root element: {root_element_id}")
        build_start_time = datetime.now()
        
        # Build the hierarchical structure starting from the root
        root_element = await build_meta_element_hierarchy_optimized(db, root_element_id)
        if not root_element:
            logger.warning(f"Failed to build hierarchy using optimized method for root element {root_element_id}")
            # Try with the original, simpler implementation as a fallback
            logger.info(f"Trying fallback hierarchy builder for root element {root_element_id}")
            root_element = await build_meta_element_hierarchy(db, root_element_id)
            
            if not root_element:
                # If both methods fail, return the collection without the hierarchical structure
                logger.error(f"Both hierarchy builders failed for collection {collection_id}")
                collection_dict["global_structure"] = None
                return CollectionHierarchical(**collection_dict)
        
        build_time = datetime.now() - build_start_time
        logger.info(f"Hierarchy built successfully in {build_time.total_seconds():.4f}s")
        
        # Add the hierarchical structure to the collection
        collection_dict["global_structure"] = root_element
        
        # Debug information
        logger.info(f"Root element ID: {root_element.id}")
        logger.info(f"Root element has {len(root_element.children)} children")
        
        total_time = datetime.now() - start_time
        logger.info(f"Total fetch time for collection {collection_id}: {total_time.total_seconds():.4f}s")
        return CollectionHierarchical(**collection_dict)
            
    except HTTPException:
        # Re-raise HTTP exceptions
        logger.warning(f"HTTP exception while fetching collection {collection_id}")
        raise
    except Exception as e:
        total_time = datetime.now() - start_time
        logger.exception(f"Failed fetching collection {collection_id} after {total_time.total_seconds():.4f}s: {str(e)}")
        raise DBError(f"Failed reading hierarchical collection from database: {str(e)}") from e


async def build_meta_element_hierarchy_optimized(db: AsyncSession, meta_element_id: UUID, max_depth: int = 10, current_depth: int = 0):
    """
    Optimized version of build_meta_element_hierarchy that reduces the N+1 query problem.
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
        
        # Make sure all database operations happen in a transaction context
        is_transaction_active = db.in_transaction()
        
        # Handle both transaction and non-transaction cases
        if is_transaction_active:
            # We're already in a transaction, proceed with queries
            return await _do_build_meta_element_hierarchy_optimized(db, meta_element_id)
        else:
            # Start a new transaction
            async with db.begin():
                return await _do_build_meta_element_hierarchy_optimized(db, meta_element_id)
    
    except Exception as e:
        logger.exception(f"Error building meta element hierarchy: {str(e)}")
        return None


async def _do_build_meta_element_hierarchy_optimized(db: AsyncSession, meta_element_id: UUID):
    """Internal function that performs the actual hierarchy building within a transaction context."""
    try:
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
            meta_element_dict["meta_detections"] = []  # Initialize meta_detections list
            
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
        
        # Create a mapping of image IDs to their parent meta elements for detection assignment later
        image_to_meta_element = {}
        image_ids = []
        
        # Create dictionary to store images
        images_dict = {}
        
        # Assign images to their parent meta elements
        image_count = 0
        for image in images:
            if image.parent_meta_element_id and str(image.parent_meta_element_id) in meta_elements_dict:
                image_dict = model.orm2dict(image)
                image_dict["detections"] = []  # Initialize empty detections list
                
                # Create ImageHierarchical object
                image_hierarchical = ImageHierarchical(**image_dict)
                
                # Add to meta element images
                meta_elements_dict[str(image.parent_meta_element_id)].images.append(image_hierarchical)
                
                # Store mapping for detection assignment later
                image_to_meta_element[str(image.id)] = str(image.parent_meta_element_id)
                image_ids.append(str(image.id))
                
                # Store image object for detection assignment later
                images_dict[str(image.id)] = image_hierarchical
                
                image_count += 1
        
        logger.info(f"[PROGRESS] (4/5) Assigned {image_count} images to meta elements")
        
        # Progress tracking: 5/5 - Loading detections
        logger.info(f"[PROGRESS] (5/5) Loading detections for meta elements and images...")
        
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
                
                # Make sure we're executing the query properly
                try:
                    detections_query = await db.execute(
                        select(model.Detection)
                        .where(model.Detection.id.in_(detection_ids))
                    )
                    detections = {
                        str(d.id): d
                        for d in detections_query.scalars().all()
                    }
                    
                    logger.info(f"[PROGRESS] (5/5) Loaded {len(detections)} detections")
                    
                    # Process detections and assign to appropriate images
                    detection_count = 0
                    images_with_detections = set()
                    
                    for meta_element_id_str, meds in med_by_meta_element.items():
                        if meta_element_id_str in meta_elements_dict:
                            meta_element = meta_elements_dict[meta_element_id_str]
                            
                            for med in meds:
                                detection_id_str = str(med.detection_id)
                                if detection_id_str in detections:
                                    detection = detections[detection_id_str]
                                    
                                    # Get the image ID from the detection
                                    detection_image_id = str(detection.image_id)
                                    
                                    # Create detection object with meta element detection
                                    detection_dict = model.orm2dict(detection)
                                    
                                    # Create meta element detection with meta role
                                    med_dict = model.orm2dict(med)
                                    if med.meta_role:
                                        med_dict["meta_role"] = base_objects.MetaRole(**model.orm2dict(med.meta_role))
                                    
                                    med_obj = base_objects.MetaElementDetection(**med_dict)
                                    
                                    # Add meta_element_detections to detection
                                    detection_dict["meta_element_detections"] = med_obj
                                    
                                    # Create hierarchical detection
                                    detection_obj = DetectionHierarchical(**detection_dict)
                                    
                                    # Add detection to the image if it exists in our processed set
                                    if detection_image_id in images_dict:
                                        images_dict[detection_image_id].detections.append(detection_obj)
                                        images_with_detections.add(detection_image_id)
                                    
                                    # Also add the detection to the meta_detections list of the meta element
                                    meta_element.meta_detections.append(detection_obj)
                                    
                                    detection_count += 1
                    
                    logger.info(f"[PROGRESS] (5/5) Assigned {detection_count} detections to {len(images_with_detections)} images")
                    
                    # Debug log for meta_detections
                    meta_elements_with_detections = sum(1 for me_id, me in meta_elements_dict.items() if me.meta_detections)
                    total_meta_detections = sum(len(me.meta_detections) for me_id, me in meta_elements_dict.items())
                    logger.info(f"[PROGRESS] (5/5) Added {total_meta_detections} meta_detections to {meta_elements_with_detections} meta elements")
                    
                    # Debug check for root element's meta_detections
                    root = meta_elements_dict.get(str(meta_element_id))
                    if root and root.meta_detections:
                        logger.info(f"[PROGRESS] (5/5) Root element has {len(root.meta_detections)} meta_detections")
                    
                    # Debug log to check some specific images and their detections
                    sample_size = min(5, len(images_dict))
                    if sample_size > 0:
                        logger.info(f"[DEBUG] Checking detections in a sample of {sample_size} images:")
                        sample_images = list(images_dict.values())[:sample_size]
                        for i, img in enumerate(sample_images):
                            logger.info(f"[DEBUG] Image {i+1}/{sample_size} (ID: {img.id}): Has {len(img.detections)} detections")
                            if img.detections:
                                logger.info(f"[DEBUG] First detection in image {i+1}: {img.detections[0].id}")
                except Exception as e:
                    # Log but continue with the process - having no detections is better than failing completely
                    logger.error(f"[PROGRESS] (5/5) Error loading detections: {str(e)}")
                    logger.exception("Detection loading error details")
            else:
                logger.info(f"[PROGRESS] (5/5) No detections to load")
        else:
            logger.info(f"[PROGRESS] (5/5) No meta elements to load detections for")
        
        # Progress tracking: completed
        logger.info(f"[PROGRESS] Hierarchy build completed successfully!")
        
        # Additional verification for the root element
        root = meta_elements_dict.get(str(meta_element_id))
        if root:
            # Count total images and detections in the hierarchy
            total_images = 0
            total_images_with_detections = 0
            total_detections = 0
            
            def count_hierarchy(element):
                nonlocal total_images, total_images_with_detections, total_detections
                if element.images:
                    total_images += len(element.images)
                    for img in element.images:
                        if img.detections:
                            total_images_with_detections += 1
                            total_detections += len(img.detections)
                
                # Also count meta_detections
                if hasattr(element, 'meta_detections') and element.meta_detections:
                    total_detections += len(element.meta_detections)
                
                for child in element.children:
                    count_hierarchy(child)
            
            count_hierarchy(root)
            logger.info(f"[VERIFY] Hierarchy contains {total_images} images, {total_images_with_detections} images with detections, and {total_detections} total detections")
        
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
    """Get children for a specific meta element with pagination."""
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
    """Get images for a specific meta element with pagination."""
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
            image_dict["detections"] = []  # Initialize with empty detections list
            images.append(ImageHierarchical(**image_dict))
            
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
    """
    Get detections for a specific meta element with pagination.
    Returns a dictionary mapping image IDs to lists of detections and a list of all detections.
    """
    try:
        # Load meta roles for the operation
        meta_roles_query = await db.execute(select(model.MetaRole))
        db_meta_roles = meta_roles_query.unique().scalars().all()
        meta_roles_by_id = {str(mr.id): base_objects.MetaRole(**model.orm2dict(mr)) for mr in db_meta_roles}
        
        # First, get all images for this meta element
        images_query = await db.execute(
            select(model.Image)
            .where(model.Image.parent_meta_element_id == meta_element_id)
        )
        images = images_query.unique().scalars().all()
        image_ids = [image.id for image in images]
        
        # Get meta_element_detections for this meta_element
        meds_query = await db.execute(
            select(model.MetaElementDetection)
            .where(model.MetaElementDetection.meta_element_id == meta_element_id)
            .offset(offset)
            .limit(limit)
        )
        meta_element_detections = meds_query.scalars().all()
        
        if not meta_element_detections:
            return {"by_image": {}, "direct": []}
        
        # Get all detection IDs from meta_element_detections
        detection_ids = [med.detection_id for med in meta_element_detections]
        
        # Get all detections at once
        detections_query = await db.execute(
            select(model.Detection)
            .where(model.Detection.id.in_(detection_ids))
        )
        all_detections = {
            str(d.id): d
            for d in detections_query.scalars().all()
        }
        
        # Create a dictionary mapping image IDs to lists of detections
        result_by_image = {}
        result_direct = []
        
        # Group detections by image_id and also collect them directly
        for med in meta_element_detections:
            if str(med.detection_id) in all_detections:
                detection = all_detections[str(med.detection_id)]
                image_id = str(detection.image_id)
                
                # Create detection object with meta_element_detection
                detection_dict = model.orm2dict(detection)
                
                # Create meta_element_detection with meta_role
                med_dict = model.orm2dict(med)
                if med.meta_role_id:
                    meta_role_id_str = str(med.meta_role_id)
                    if meta_role_id_str in meta_roles_by_id:
                        med_dict["meta_role"] = meta_roles_by_id[meta_role_id_str]
                
                detection_dict["meta_element_detections"] = base_objects.MetaElementDetection(**med_dict)
                detection_obj = DetectionHierarchical(**detection_dict)
                
                # Add to result_by_image dictionary
                if image_id not in result_by_image:
                    result_by_image[image_id] = []
                
                result_by_image[image_id].append(detection_obj)
                
                # Also add to direct list
                result_direct.append(detection_obj)
        
        return {"by_image": result_by_image, "direct": result_direct}
        
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed reading meta element detections from database")
        raise DBError(f"Failed reading meta element detections from database") from e


async def import_metakat_collection(file: UploadFile, db: AsyncSession):
    """Import a MetaKat formatted dataset using an optimized process."""
    from metacheck.cruds import crud_import
    return await crud_import.import_metakat_collection(file, db)


async def build_meta_element_hierarchy(db: AsyncSession, meta_element_id: UUID, max_depth: int = 10, current_depth: int = 0):
    """
    Recursively build the hierarchy for a meta element.
    This is a simpler, potentially less performant version compared to the optimized one.
    
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
    
    # Make sure all database operations happen in a transaction context
    is_transaction_active = db.in_transaction()
    
    try:
        # Handle both transaction and non-transaction cases
        if is_transaction_active:
            # We're already in a transaction, proceed with queries
            return await _do_build_meta_element_hierarchy(db, meta_element_id, max_depth, current_depth)
        else:
            # Start a new transaction
            async with db.begin():
                return await _do_build_meta_element_hierarchy(db, meta_element_id, max_depth, current_depth)
    
    except Exception as e:
        logger.exception(f"Error building meta element hierarchy: {str(e)}")
        return None


async def _do_build_meta_element_hierarchy(db: AsyncSession, meta_element_id: UUID, max_depth: int = 10, current_depth: int = 0):
    """Internal function that performs the actual hierarchy building within a transaction context."""
    try:
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
        meta_element_dict["meta_detections"] = []  # Initialize meta_detections list
        
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
            child_hier = await _do_build_meta_element_hierarchy(
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
        
        # Dictionary to store images by ID for later detection assignment
        images_dict = {}
        
        # Add images to the element
        for image in images:
            image_dict = model.orm2dict(image)
            image_dict["detections"] = []  # Initialize empty detections list
            
            # Create image hierarchical object
            image_hierarchical = ImageHierarchical(**image_dict)
            
            # Add to meta element
            element.images.append(image_hierarchical)
            
            # Store for detection assignment
            images_dict[str(image.id)] = image_hierarchical
        
        # Get detections for this meta element
        meta_element_detections_query = await db.execute(
            select(model.MetaElementDetection)
            .options(joinedload(model.MetaElementDetection.meta_role))
            .where(model.MetaElementDetection.meta_element_id == meta_element_id)
        )
        meta_element_detections = meta_element_detections_query.unique().scalars().all()
        
        # For each meta element detection, get the detection and assign to appropriate image
        for med in meta_element_detections:
            detection_query = await db.execute(
                select(model.Detection)
                .where(model.Detection.id == med.detection_id)
            )
            detection = detection_query.unique().scalar_one_or_none()
            
            if detection:
                # Get the image ID for this detection
                detection_image_id = str(detection.image_id)
                
                # Only process if the image exists in our images dictionary
                if detection_image_id in images_dict:
                    detection_dict = model.orm2dict(detection)
                    
                    # Create meta element detection with meta_role
                    med_dict = model.orm2dict(med)
                    if med.meta_role:
                        med_dict["meta_role"] = base_objects.MetaRole(**model.orm2dict(med.meta_role))
                        
                    med_obj = base_objects.MetaElementDetection(**med_dict)
                    
                    # Create detection with meta_element_detection
                    detection_dict["meta_element_detections"] = med_obj
                    detection_obj = DetectionHierarchical(**detection_dict)
                    
                    # Add detection to the image
                    images_dict[detection_image_id].detections.append(detection_obj)
                    
                    # Also add the detection to the meta_detections list of the meta element
                    element.meta_detections.append(detection_obj)
        
        # Debug log for meta_detections in non-optimized version
        if element.meta_detections:
            logger.info(f"[DEBUG] Element {meta_element_id} has {len(element.meta_detections)} meta_detections")
        
        return element
    except Exception as e:
        logger.exception(f"Error building meta element hierarchy details: {str(e)}")
        return None


async def invalidate_all_collection_caches(db: AsyncSession):
    """Invalidate the hierarchical structure cache for all collections."""
    try:
        logger.info("[CACHE] Invalidating hierarchical structure cache for all collections")
        
        # Check if transaction is already in progress
        is_transaction_active = db.in_transaction()
        
        if is_transaction_active:
            # If transaction is active, just run the query
            result = await db.execute(
                update(model.Collection)
                .values(hierarchical_structure=None)
            )
            rows_affected = result.rowcount
            logger.info(f"[CACHE] Successfully invalidated hierarchical structure for {rows_affected} collections")
        else:
            # If no transaction is active, start one
            async with db.begin():
                result = await db.execute(
                    update(model.Collection)
                    .values(hierarchical_structure=None)
                )
                rows_affected = result.rowcount
                logger.info(f"[CACHE] Successfully invalidated hierarchical structure for {rows_affected} collections")
        
        return rows_affected
    except exc.SQLAlchemyError as e:
        # Just log the error but don't raise an exception
        # This is a non-critical operation
        logger.warning(f"[CACHE] Failed to invalidate cache for all collections: {str(e)}")
        return 0


def _extract_periodical_flag(meta_element):
    """Extract the boolean periodical flag from a meta_element's attributes."""
    if not hasattr(meta_element, 'attributes') or not meta_element.attributes:
        return None
        
    # Check if it's a dict or a JSON string
    attributes = meta_element.attributes
    if isinstance(attributes, str):
        try:
            import json
            attributes = json.loads(attributes)
        except:
            return None
            
    # Return the periodical flag if it exists
    if isinstance(attributes, dict) and 'periodical' in attributes:
        return attributes['periodical']
        
    return None


async def get_collection_hierarchical_tree(db: AsyncSession, collection_id: UUID):
    """
    Get a collection's hierarchical structure organized as a tree with detections arranged by role.
    
    This provides a frontend-friendly structure where detections are organized by their roles
    (title, author, etc.) rather than by the images they appear in.
    
    Returns:
        A hierarchical tree object with the following structure:
        {
            "id": "uuid",
            "periodical": true/false,  // Indicates if this is a periodical
            "subTitle": detection,
            "author": [detection1, detection2, ...],
            ... other metadata fields ...
            "volumes": [ // Only for multi-part monographs
                {
                    "id": "uuid",
                    "periodical": true/false,
                    ... volume metadata fields ...
                    "issues": [ // For volumes that have issues
                        {
                            "id": "uuid",
                            "periodical": true/false,
                            ... issue metadata ...
                        }
                    ]
                }
            ]
        }
    """
    logger.info(f"Building hierarchical tree for collection {collection_id}")
    
    # Variables to hold our data outside of the database transaction
    collection_data = None
    error_message = None
    
    try:
        # Step 1: Get the collection data in a dedicated transaction
        # Always use a clean session for this operation to avoid transaction issues
        from metacheck.database import get_async_session
        
        # Use a dedicated session to avoid transaction conflicts
        async_session_gen = get_async_session()
        clean_db = await anext(async_session_gen)
        
        try:
            # Fetch the hierarchical collection data in a fresh transaction
            async with clean_db.begin():
                logger.debug(f"Using dedicated session for get_collection_hierarchical")
                # Use use_cache=False and force_rebuild=False to avoid nested cache operations
                collection_data = await get_collection_hierarchical(clean_db, collection_id, use_cache=False, force_rebuild=False)
        except Exception as db_error:
            logger.exception(f"Error fetching hierarchical collection: {str(db_error)}")
            error_message = f"Failed reading hierarchical collection from database: {str(db_error)}"
        finally:
            # Always close the dedicated session
            await clean_db.close()
        
        # If we failed to get the data or it's not valid, return early
        if error_message:
            raise DBError(error_message)
        
        if not collection_data or not collection_data.global_structure:
            logger.warning(f"Collection {collection_id} not found or has no global structure")
            return None
        
        # Step 2: Now that we have the data, process it entirely in memory
        # No more database operations from this point forward
        logger.info(f"Collection data loaded, now building tree structure")
        
        root_element = collection_data.global_structure
        element_type = root_element.meta_element_type.name if root_element.meta_element_type else "unknown"
        
        # Create the base tree structure
        result = {
            "id": str(root_element.id),
            "type": element_type
        }
        
        # Add periodical flag if it exists
        periodical_flag = _extract_periodical_flag(root_element)
        if periodical_flag is not None:
            result['periodical'] = periodical_flag
            logger.debug(f"Added periodical={periodical_flag} flag to root element")
        
        # Process detections for the root element - synchronous call
        _process_detections_for_tree(result, root_element)
        
        # Process children based on element type
        if element_type == "title":
            # Process volumes
            result["volumes"] = []
            volume_children = [
                child for child in root_element.children 
                if child.meta_element_type and child.meta_element_type.name == "volume"
            ]
            
            for volume in volume_children:
                # Create volume node with type field
                volume_node = {
                    "id": str(volume.id),
                    "type": "volume" 
                }
                
                # Add periodical flag if it exists
                periodical_flag = _extract_periodical_flag(volume)
                if periodical_flag is not None:
                    volume_node['periodical'] = periodical_flag
                    logger.debug(f"Added periodical={periodical_flag} flag to volume")
                
                # Process detections for this volume - synchronous call
                _process_detections_for_tree(volume_node, volume)
                
                # Process issues for this volume
                issue_children = [
                    child for child in volume.children 
                    if child.meta_element_type and child.meta_element_type.name == "issue"
                ]
                
                if issue_children:
                    volume_node["issues"] = []
                    
                    for issue in issue_children:
                        # Create issue node with type field
                        issue_node = {
                            "id": str(issue.id),
                            "type": "issue"
                        }
                        
                        # Add periodical flag if it exists
                        periodical_flag = _extract_periodical_flag(issue)
                        if periodical_flag is not None:
                            issue_node['periodical'] = periodical_flag
                            logger.debug(f"Added periodical={periodical_flag} flag to issue")
                        
                        # Process detections for this issue - synchronous call
                        _process_detections_for_tree(issue_node, issue)
                        volume_node["issues"].append(issue_node)
                    
                    logger.info(f"Volume {volume.id} has {len(issue_children)} issues")
                
                result["volumes"].append(volume_node)
        
        # For volumes that are the root element, check for issues too
        elif element_type == "volume":
            issue_children = [
                child for child in root_element.children 
                if child.meta_element_type and child.meta_element_type.name == "issue"
            ]
            
            if issue_children:
                result["issues"] = []
                
                for issue in issue_children:
                    # Create issue node with type field
                    issue_node = {
                        "id": str(issue.id),
                        "type": "issue"
                    }
                    
                    # Add periodical flag if it exists
                    periodical_flag = _extract_periodical_flag(issue)
                    if periodical_flag is not None:
                        issue_node['periodical'] = periodical_flag
                        logger.debug(f"Added periodical={periodical_flag} flag to issue")
                    
                    # Process detections for this issue - synchronous call
                    _process_detections_for_tree(issue_node, issue)
                    result["issues"].append(issue_node)
                
                logger.info(f"Root volume {root_element.id} has {len(issue_children)} issues")
        
        logger.info(f"Hierarchical tree built successfully for collection {collection_id}")
        return result
            
    except Exception as e:
        logger.exception(f"Error building hierarchical tree for collection {collection_id}: {str(e)}")
        raise DBError(f"Failed building hierarchical tree: {str(e)}") from e


def _process_detections_for_tree(tree_node, meta_element):
    """
    Process detections for a tree node, organizing them by their roles.
    This function works entirely with in-memory data.
    """
    # Get meta_element type for logging
    element_type = meta_element.meta_element_type.name if meta_element.meta_element_type else "unknown"
    logger.debug(f"Processing detections for {element_type} element {meta_element.id}")
    
    # Get all detections from the meta element's images
    all_detections = []
    
    # Collect from images
    for image in meta_element.images:
        if hasattr(image, 'detections') and image.detections:
            all_detections.extend(image.detections)
    
    # Also collect from meta_detections if available
    if hasattr(meta_element, 'meta_detections') and meta_element.meta_detections:
        all_detections.extend(meta_element.meta_detections)
    
    logger.debug(f"Found {len(all_detections)} total detections for element {meta_element.id}")
    
    # Remove duplicates by detection ID
    unique_detections = {}
    for detection in all_detections:
        unique_detections[str(detection.id)] = detection
    
    logger.debug(f"After deduplication: {len(unique_detections)} unique detections")
    
    # Determine single-value fields based on meta element type
    single_value_fields = ["title", "subTitle", "partNumber", "partName", "dateIssued", 
                          "edition", "placeTerm"]
    
    # Add issue-specific fields
    if meta_element.meta_element_type and meta_element.meta_element_type.name == "issue":
        single_value_fields.extend(["issueNumber", "issueDate", "issueSeason", "issueVolume"])
    
    # Process each detection
    processed_roles = set()
    
    for detection in unique_detections.values():
        if not hasattr(detection, 'meta_element_detections'):
            logger.debug(f"Detection {detection.id} has no meta_element_detections")
            continue
            
        # Get the role name (meta_role)
        med = detection.meta_element_detections
        if not med or not hasattr(med, 'meta_role') or not med.meta_role:
            logger.debug(f"Detection {detection.id} has no meta_role")
            continue
            
        # Use computed_name or computed_display_name, falling back to attribute type name if needed
        role_name = None
        meta_role = med.meta_role
        
        # Log available properties on meta_role for debugging
        logger.debug(f"MetaRole properties: {dir(meta_role)}")
        
        if hasattr(meta_role, 'computed_name') and meta_role.computed_name:
            # Split the computed_name and exclude the first part (e.g., "volume.title" -> "title")
            full_name = meta_role.computed_name
            parts = full_name.split('.')
            if len(parts) > 1:
                role_name = '.'.join(parts[1:])  # Join all parts after the first
                logger.debug(f"Using split computed_name: '{full_name}' -> '{role_name}'")
            else:
                role_name = full_name
                logger.debug(f"Using computed_name (no split needed): {role_name}")
        elif hasattr(meta_role, 'computed_display_name') and meta_role.computed_display_name:
            # Split the computed_display_name and exclude the first part
            full_name = meta_role.computed_display_name
            parts = full_name.split('.')
            if len(parts) > 1:
                role_name = '.'.join(parts[1:])  # Join all parts after the first
                logger.debug(f"Using split computed_display_name: '{full_name}' -> '{role_name}'")
            else:
                role_name = full_name
                logger.debug(f"Using computed_display_name (no split needed): {role_name}")
        elif hasattr(meta_role, 'meta_element_detection_attribute_type') and meta_role.meta_element_detection_attribute_type:
            attr_type = meta_role.meta_element_detection_attribute_type
            # If attr_type is an object with a name property
            if hasattr(attr_type, 'name'):
                role_name = attr_type.name
                logger.debug(f"Using attribute_type.name: {role_name}")
            # If it's a string or another primitive type, use it directly
            elif isinstance(attr_type, (str, int, float, bool)):
                role_name = str(attr_type)
                logger.debug(f"Using attribute_type as string: {role_name}")
            else:
                logger.debug(f"attribute_type has no name property: {dir(attr_type)}")
        # Last resort: try to extract ID as a name
        elif hasattr(meta_role, 'meta_element_detection_attribute_type_id') and meta_role.meta_element_detection_attribute_type_id:
            role_name = f"attribute_{meta_role.meta_element_detection_attribute_type_id}"
            logger.debug(f"Using attribute_type_id as name: {role_name}")
        else:
            logger.debug(f"No suitable name found in meta_role: {meta_role}")
        
        # Skip if we couldn't determine the role name
        if not role_name:
            logger.warning(f"Could not determine role name for detection {detection.id}")
            continue
            
        # Check if computed_type exists, otherwise construct it
        if not hasattr(detection, 'computed_type'):
            # Format should be just the role_name since we're excluding the element type
            detection.computed_type = role_name
        
        # Convert snake_case to camelCase
        camel_role = _snake_to_camel(role_name)
        processed_roles.add(camel_role)
        
        # Add to the appropriate field in the tree node
        if camel_role in single_value_fields:
            # Single-value fields
            tree_node[camel_role] = detection
            logger.debug(f"Added detection {detection.id} as single value for role {camel_role}")
        else:
            # Multi-value fields (arrays)
            if camel_role not in tree_node:
                tree_node[camel_role] = []
            tree_node[camel_role].append(detection)
            logger.debug(f"Added detection {detection.id} to array for role {camel_role}")
    
    logger.debug(f"Processed roles for element {meta_element.id}: {sorted(list(processed_roles))}")


def _snake_to_camel(snake_str):
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


async def export_collection_as_metakat(db: AsyncSession, collection_id: UUID):
    """
    Export a collection from database to MetaKatImport format.
    Converts a collection and all its related data to the MetaKatImport format.
    """
    try:
        from fastapi import HTTPException
        from metacheck.schemas.metakat_object import (
            MetaKatImport, ElementType, Detection
        )
        import logging
        from metacheck.constants import META_ELEMENT_TYPE_IDS
        from uuid import UUID
        
        logger = logging.getLogger(__name__)
        
        # Use a dedicated session to avoid transaction conflicts
        from metacheck.database import get_async_session
        async_session_gen = get_async_session()
        clean_db = await anext(async_session_gen)
        
        try:
            # Step 1: Get the collection data with hierarchical structure
            collection_data = None
            
            # Fetch the hierarchical collection data in a fresh transaction
            async with clean_db.begin():
                from sqlalchemy import select
                from sqlalchemy.orm import selectinload, joinedload

                # Get the collection with root meta element
                collection_query = await clean_db.execute(
                    select(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .options(joinedload(model.Collection.root_meta_element))
                )
                db_collection = collection_query.unique().scalar_one_or_none()
                
                if not db_collection:
                    logger.warning(f"Collection {collection_id} not found")
                    raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
                
                # Get the root element ID
                root_element_id = db_collection.root_meta_element_id
                
                if not root_element_id:
                    logger.warning(f"No root meta element set for collection {collection_id}")
                    raise HTTPException(status_code=400, detail="Collection has no root element")
                
                # Build the hierarchical structure starting from the root
                root_element = await build_meta_element_hierarchy_optimized(clean_db, root_element_id)
                if not root_element:
                    # Try with the original, simpler implementation as a fallback
                    root_element = await build_meta_element_hierarchy(clean_db, root_element_id)
                    
                    if not root_element:
                        # If both methods fail, return an error
                        raise HTTPException(status_code=500, detail="Failed to build element hierarchy")
                
                # Store the root element for later use
                collection_data = {
                    "id": db_collection.id,
                    "global_structure": root_element
                }
        except Exception as e:
            logger.exception(f"Error fetching collection hierarchy: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch collection hierarchy: {str(e)}")
        finally:
            # Always close the dedicated session
            await clean_db.close()
        
        # Step 2: Initialize the mappings and lists needed for MetaKatImport
        detection_to_bbox = {}
        detection_to_page_mapping = {}
        page_to_image_mapping = {}
        
        # Get the mappings for element type IDs to names
        type_id_to_name = {str(v): k for k, v in META_ELEMENT_TYPE_IDS.items()}
        
        # Step 3: Process the root element and its children into MetaKat format elements
        metakat_elements = []
        
        # Process the global structure
        root_element = collection_data["global_structure"]
        root_type_name = root_element.meta_element_type.name if root_element.meta_element_type else "unknown"
        
        # Create element data for the root
        root_data = {
            "id": root_element.id,
            "type": root_type_name,
        }
        
        # Add parent_id if available
        if hasattr(root_element, 'parent_id') and root_element.parent_id:
            root_data["parent_id"] = root_element.parent_id
        
        # Add periodical flag if available
        periodical_flag = _extract_periodical_flag(root_element)
        if periodical_flag is not None:
            root_data["periodical"] = periodical_flag
        
        # Process the root element detections
        _extract_detections_for_metakat(root_element, root_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
        
        # Add the root element to the results
        metakat_elements.append(root_data)
        
        # Process children based on element type
        if root_type_name == "title":
            # Process volumes
            volume_children = [
                child for child in root_element.children 
                if child.meta_element_type and child.meta_element_type.name == "volume"
            ]
            
            for volume in volume_children:
                # Create the volume element
                volume_data = {
                    "id": volume.id,
                    "type": "volume",
                    "parent_id": root_element.id
                }
                
                # Add periodical flag if available
                periodical_flag = _extract_periodical_flag(volume)
                if periodical_flag is not None:
                    volume_data["periodical"] = periodical_flag
                
                # Process the volume detections
                _extract_detections_for_metakat(volume, volume_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
                
                # Add the volume to the results
                metakat_elements.append(volume_data)
                
                # Process issues for this volume
                issue_children = [
                    child for child in volume.children 
                    if child.meta_element_type and child.meta_element_type.name == "issue"
                ]
                
                for issue in issue_children:
                    # Create the issue element
                    issue_data = {
                        "id": issue.id,
                        "type": "issue",
                        "parent_id": volume.id
                    }
                    
                    # Add periodical flag if available
                    periodical_flag = _extract_periodical_flag(issue)
                    if periodical_flag is not None:
                        issue_data["periodical"] = periodical_flag
                    
                    # Process the issue detections
                    _extract_detections_for_metakat(issue, issue_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
                    
                    # Add the issue to the results
                    metakat_elements.append(issue_data)
                    
                    # Process pages for this issue
                    _process_element_pages(issue, metakat_elements, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
                
                # Process pages directly under volume if any
                _process_element_pages(volume, metakat_elements, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
                
        elif root_type_name == "volume":
            # Process issues
            issue_children = [
                child for child in root_element.children 
                if child.meta_element_type and child.meta_element_type.name == "issue"
            ]
            
            for issue in issue_children:
                # Create the issue element
                issue_data = {
                    "id": issue.id,
                    "type": "issue",
                    "parent_id": root_element.id
                }
                
                # Add periodical flag if available
                periodical_flag = _extract_periodical_flag(issue)
                if periodical_flag is not None:
                    issue_data["periodical"] = periodical_flag
                
                # Process the issue detections
                _extract_detections_for_metakat(issue, issue_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
                
                # Add the issue to the results
                metakat_elements.append(issue_data)
                
                # Process pages for this issue
                _process_element_pages(issue, metakat_elements, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
            
            # Process pages directly under root volume if any
            _process_element_pages(root_element, metakat_elements, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
            
        # No matter the type, also process pages directly under the root
        _process_element_pages(root_element, metakat_elements, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
        
        # Step 4: Create and return the MetaKatImport object
        metakat_import = MetaKatImport(
            batch_id=collection_id,
            elements=metakat_elements,
            detection_to_bbox=detection_to_bbox,
            detection_to_page_mapping=detection_to_page_mapping,
            page_to_image_mapping=page_to_image_mapping
        )
        
        return metakat_import.model_dump()
        
    except Exception as e:
        logger.error(f"Failed to export collection as MetaKat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export collection: {str(e)}")


def _extract_detections_for_metakat(element, result_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping):
    """Extract detection data from an element for MetaKat format."""
    import logging
    from uuid import UUID
    
    logger = logging.getLogger(__name__)
    
    # Process meta_detections directly
    if hasattr(element, 'meta_detections') and element.meta_detections:
        _process_meta_detections(element.meta_detections, result_data, detection_to_bbox, detection_to_page_mapping)
    
    # Process detections from images
    if hasattr(element, 'images') and element.images:
        for image in element.images:
            # Add to page_to_image_mapping
            if hasattr(image, 'name') and image.name:
                page_to_image_mapping[image.id] = image.name
            
            # Process detections from this image
            if hasattr(image, 'detections') and image.detections:
                _process_detections_from_image(image.detections, result_data, detection_to_bbox, detection_to_page_mapping)


def _process_meta_detections(meta_detections, result_data, detection_to_bbox, detection_to_page_mapping):
    """Process meta_detections from an element."""
    import logging
    logger = logging.getLogger(__name__)
    
    for detection in meta_detections:
        try:
            # Skip if no meta_element_detections or meta_role
            if not hasattr(detection, 'meta_element_detections') or not detection.meta_element_detections:
                continue
                
            med = detection.meta_element_detections
            if not hasattr(med, 'meta_role') or not med.meta_role:
                continue
            
            # Get the attribute name from meta_role
            meta_role = med.meta_role
            attribute_name = None
            
            # Try to get the attribute name from computed_name
            if hasattr(meta_role, 'computed_name') and meta_role.computed_name:
                parts = meta_role.computed_name.split('.')
                if len(parts) > 1:
                    # Convert snake_case to camelCase
                    attribute_name = _snake_to_camel(parts[1])
            
            # If attribute_name is still None, try other methods
            if not attribute_name and hasattr(meta_role, 'computed_display_name') and meta_role.computed_display_name:
                parts = meta_role.computed_display_name.split(' ')
                if len(parts) > 1:
                    # Convert "Volume Title" to "title"
                    attribute_name = parts[-1].lower()
            
            # Skip if we couldn't determine an attribute name
            if not attribute_name:
                logger.warning(f"Could not determine attribute name for detection {detection.id}")
                continue
            
            # Create the detection tuple (text, confidence, id)
            detection_tuple = (
                str(detection.value) if detection.value is not None else "",
                float(detection.confidence) if detection.confidence is not None else 1.0,
                detection.id
            )
            
            # Store in the result data
            if attribute_name in result_data:
                # If already a list, append to it
                if isinstance(result_data[attribute_name], list):
                    result_data[attribute_name].append(detection_tuple)
                # If already a tuple (single detection), convert to list and add new one
                else:
                    result_data[attribute_name] = [result_data[attribute_name], detection_tuple]
            else:
                # For some fields that are typically single-valued, store as a direct tuple
                single_value_fields = ["title", "subTitle", "dateIssued", "partNumber", "partName", "edition", "placeTerm"]
                if attribute_name in single_value_fields:
                    result_data[attribute_name] = detection_tuple
                else:
                    # Otherwise store as a list with one item
                    result_data[attribute_name] = [detection_tuple]
            
            # Add to detection_to_bbox if bbox is available
            if hasattr(detection, 'bbox') and detection.bbox:
                try:
                    bbox_parts = detection.bbox.split(',')
                    if len(bbox_parts) == 4:
                        detection_to_bbox[detection.id] = (
                            float(bbox_parts[0]),
                            float(bbox_parts[1]),
                            float(bbox_parts[2]),
                            float(bbox_parts[3])
                        )
                except Exception as e:
                    logger.warning(f"Failed to parse bbox for detection {detection.id}: {e}")
            
            # Add to detection_to_page_mapping if image_id is available
            if hasattr(detection, 'image_id') and detection.image_id:
                detection_to_page_mapping[detection.id] = detection.image_id
                
        except Exception as e:
            logger.warning(f"Error processing meta detection: {e}")


def _process_detections_from_image(detections, result_data, detection_to_bbox, detection_to_page_mapping):
    """Process detections from an image."""
    import logging
    logger = logging.getLogger(__name__)
    
    for detection in detections:
        try:
            # Skip if no meta_element_detections or meta_role
            if not hasattr(detection, 'meta_element_detections') or not detection.meta_element_detections:
                continue
                
            med = detection.meta_element_detections
            if not hasattr(med, 'meta_role') or not med.meta_role:
                continue
            
            # Get the attribute name from meta_role (same logic as in _process_meta_detections)
            meta_role = med.meta_role
            attribute_name = None
            
            # Try to get the attribute name from computed_name
            if hasattr(meta_role, 'computed_name') and meta_role.computed_name:
                parts = meta_role.computed_name.split('.')
                if len(parts) > 1:
                    # Convert snake_case to camelCase
                    attribute_name = _snake_to_camel(parts[1])
            
            # If attribute_name is still None, try other methods
            if not attribute_name and hasattr(meta_role, 'computed_display_name') and meta_role.computed_display_name:
                parts = meta_role.computed_display_name.split(' ')
                if len(parts) > 1:
                    # Convert "Volume Title" to "title"
                    attribute_name = parts[-1].lower()
            
            # Skip if we couldn't determine an attribute name
            if not attribute_name:
                logger.warning(f"Could not determine attribute name for detection {detection.id}")
                continue
            
            # Create the detection tuple (text, confidence, id)
            detection_tuple = (
                str(detection.value) if detection.value is not None else "",
                float(detection.confidence) if detection.confidence is not None else 1.0,
                detection.id
            )
            
            # Store in the result data
            if attribute_name in result_data:
                # If already a list, append to it
                if isinstance(result_data[attribute_name], list):
                    result_data[attribute_name].append(detection_tuple)
                # If already a tuple (single detection), convert to list and add new one
                else:
                    result_data[attribute_name] = [result_data[attribute_name], detection_tuple]
            else:
                # For some fields that are typically single-valued, store as a direct tuple
                single_value_fields = ["title", "subTitle", "dateIssued", "partNumber", "partName", "edition", "placeTerm"]
                if attribute_name in single_value_fields:
                    result_data[attribute_name] = detection_tuple
                else:
                    # Otherwise store as a list with one item
                    result_data[attribute_name] = [detection_tuple]
            
            # Add to detection_to_bbox if bbox is available
            if hasattr(detection, 'bbox') and detection.bbox:
                try:
                    bbox_parts = detection.bbox.split(',')
                    if len(bbox_parts) == 4:
                        detection_to_bbox[detection.id] = (
                            float(bbox_parts[0]),
                            float(bbox_parts[1]),
                            float(bbox_parts[2]),
                            float(bbox_parts[3])
                        )
                except Exception as e:
                    logger.warning(f"Failed to parse bbox for detection {detection.id}: {e}")
            
            # Add to detection_to_page_mapping if image_id is available
            if hasattr(detection, 'image_id') and detection.image_id:
                detection_to_page_mapping[detection.id] = detection.image_id
                
        except Exception as e:
            logger.warning(f"Error processing image detection: {e}")


def _process_element_pages(element, elements_list, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping):
    """Process page elements."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Look for child elements that are pages
    page_children = [
        child for child in element.children 
        if child.meta_element_type and child.meta_element_type.name == "page"
    ]
    
    for page in page_children:
        try:
            # Create the page element
            page_data = {
                "id": page.id,
                "type": "page",
                "parent_id": element.id
            }
            
            # Add pageIndex if available
            if hasattr(page, 'order') and page.order:
                page_data["pageIndex"] = page.order
            
            # Process the page detections
            _extract_detections_for_metakat(page, page_data, detection_to_bbox, detection_to_page_mapping, page_to_image_mapping)
            
            # Add the page to the results
            elements_list.append(page_data)
            
        except Exception as e:
            logger.warning(f"Error processing page element {page.id}: {e}")


def _snake_to_camel(snake_str):
    """Convert snake_case to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])