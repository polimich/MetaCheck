import logging
import os
import uuid
from typing import Dict, List
from uuid import UUID


import aiofiles
from fastapi import UploadFile, HTTPException
from sqlalchemy import select, update, exc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.metacheck.schemas import base_objects
from db import model
from metacheck.constants import META_ELEMENT_TYPE_IDS
from metacheck_common.config import config

logger = logging.getLogger(__name__)

async def import_metakat_collection(file: UploadFile, db: AsyncSession):
    """Import a MetaKat formatted dataset - optimized for large batches"""
    if "json" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type - only json files are supported.",
        )
    
    try:
        import time
        from metacheck.cruds import crud_general, crud_image, crud_meta_element
        from metacheck.schemas.metakat_object import MetaKatImport
        
        # Start timing for performance metrics
        start_time = time.time()
        
        # Get project root for resolving image paths
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_file_dir, "../../.."))
        logger.info(f"Project root directory: {project_root}")
        
        # Parse data and process in phases
        logger.info("════════════════════════════════════════════════════")
        logger.info("STARTING METAKAT IMPORT")
        logger.info("════════════════════════════════════════════════════")
        
        metakat_data = await _parse_metakat_json(file)
        parse_time = time.time()
        logger.info(f"JSON parsing completed in {parse_time - start_time:.2f}s")
        
        # Initialize counters
        success_counters = {
            "volumes": 0, "images": 0, "issues": 0, "titles": 0, "supplements": 0, 
            "chapters": 0, "articles": 0, "detections": 0, "meta_element_detections": 0
        }
        
        # Log import summary
        total_elements = sum(len(metakat_data.get(k, [])) for k in ["volumes", "issues", "titles", "supplements", "chapters", "articles"])
        total_pages = len(metakat_data.get("pages", []))
        total_detections = len(metakat_data.get("detections", []))
        
        logger.info("IMPORT SUMMARY:")
        logger.info(f"  • Collection ID: {metakat_data.get('batch_id', 'New')}")
        logger.info(f"  • Meta Elements: {total_elements} total")
        for element_type in ["titles", "volumes", "issues", "chapters", "articles", "supplements"]:
            count = len(metakat_data.get(element_type, []))
            if count > 0:
                logger.info(f"    - {element_type.capitalize()}: {count}")
        logger.info(f"  • Pages: {total_pages}")
        logger.info(f"  • Detections: {total_detections}")
        
        # Create/update collection and process meta elements
        phase1_start = time.time()
        logger.info("════════════════════════════════════════════════════")
        logger.info("PHASE 1: Collection and Meta Elements")
        collection_id = await _create_or_update_collection(db, metakat_data)
        root_element_id = await _process_meta_elements_optimized(db, metakat_data, collection_id, success_counters)
        phase1_time = time.time() - phase1_start
        logger.info(f"Phase 1 completed in {phase1_time:.2f}s")
        
        # Process images
        phase2_start = time.time()
        logger.info("════════════════════════════════════════════════════")
        logger.info("PHASE 2: Image Processing")
        image_id_map = await _process_images_parallel(db, metakat_data, collection_id, project_root, success_counters)
        phase2_time = time.time() - phase2_start
        logger.info(f"Phase 2 completed in {phase2_time:.2f}s")
        
        # Process detections
        phase3_start = time.time()
        logger.info("════════════════════════════════════════════════════")
        logger.info("PHASE 3: Detection Processing")
        verification_stats = await _process_detections_in_batches(db, metakat_data, collection_id, image_id_map, success_counters)
        phase3_time = time.time() - phase3_start
        logger.info(f"Phase 3 completed in {phase3_time:.2f}s")
        
        # Log summary of root element selection
        if root_element_id:
            logger.info(f"Root element was automatically set to: {root_element_id}")
        else:
            logger.warning(f"WARNING: No root element was set for collection {collection_id}")
        
        # Log final import summary with success rates
        total_time = time.time() - start_time
        logger.info("════════════════════════════════════════════════════")
        logger.info("IMPORT COMPLETE")
        logger.info("════════════════════════════════════════════════════")
        logger.info(f"Collection ID: {collection_id}")
        logger.info(f"Total Processing Time: {total_time:.2f}s")
        
        # Success rates for different entity types
        logger.info("SUCCESS METRICS:")
        for entity_type, count in success_counters.items():
            total = 0
            if entity_type == "images":
                total = total_pages
            elif entity_type == "detections":
                total = total_detections
            elif entity_type in metakat_data:
                total = len(metakat_data[entity_type])
                
            if total > 0:
                success_rate = (count / total) * 100
                logger.info(f"  • {entity_type.capitalize()}: {count}/{total} ({success_rate:.1f}%)")
        
        # Detection verification summary
        if verification_stats['total_detections'] > 0:
            total_processed = verification_stats['success'] + verification_stats['failed']
            success_rate = (verification_stats['success'] / total_processed * 100) if total_processed > 0 else 0
            logger.info(f"  • Detection verification: {verification_stats['success']}/{total_processed} ({success_rate:.1f}%)")
            if verification_stats['failed'] > 0:
                logger.warning(f"WARNING: Failed to verify {verification_stats['failed']} detections")
        
        return {
            "message": "MetaKat collection imported successfully", 
            "collection_id": str(collection_id),
            "elements_imported": success_counters,
            "verification_stats": verification_stats,
            "processing_time": total_time
        }
        
    except Exception as e:
        logger.exception(f"IMPORT FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process the MetaKat import file: {str(e)}")



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
            # Reset root_meta_element_id when updating the collection
            # It will be set again after meta elements are processed
            await db.execute(
                update(model.Collection)
                .where(model.Collection.id == collection_id)
                .values(
                    name=collection_name,
                    description=metakat_data.get("description", ""),
                    info=metakat_data.get("info", ""),
                    root_meta_element_id=None  # Clear the root meta element reference
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


async def _process_images_parallel(db: AsyncSession, metakat_data: dict, collection_id: UUID, project_root: str, success_counters: dict):
    """Process images in sequential batches to avoid database concurrency issues"""
    import time
    from metacheck.cruds import crud_image
    
    logger.info("Processing images in batches...")
    
    if "images" not in success_counters:
        success_counters["images"] = 0
    
    image_id_map = {}
    pages_data = metakat_data.get("pages", [])
    
    if not pages_data:
        logger.info("No images to process")
        return image_id_map
    
    # First check which images already exist to avoid processing them
    async with db.begin():
        image_ids = [page.get("id") for page in pages_data if page.get("id")]
        if image_ids:
            existing_images_query = await db.execute(
                select(model.Image.id).filter(model.Image.id.in_(image_ids))
            )
            existing_image_ids = {str(id) for id, in existing_images_query.unique()}
            logger.info(f"Found {len(existing_image_ids)} images that already exist")
        else:
            existing_image_ids = set()
    
    # Filter out images that already exist
    pages_to_process = []
    for page_data in pages_data:
        image_id = page_data.get("id")
        if not image_id:
            continue
            
        if str(image_id) in existing_image_ids:
            logger.debug(f"Image already exists: {image_id}")
            image_id_map[str(image_id)] = image_id
            success_counters["images"] += 1
            continue
            
        # Only process images with parent element
        if not page_data.get("parent_id"):
            logger.warning(f"WARNING: No parent element found for image: {image_id}, skipping")
            continue
            
        # Only process images with valid path
        image_path = page_data.get("image_path")
        if not image_path:
            logger.warning(f"WARNING: No image path found for image: {image_id}, skipping")
            continue
            
        pages_to_process.append(page_data)
    
    total_to_process = len(pages_to_process)
    logger.info(f"Processing {total_to_process} new images in batches")
    
    if total_to_process == 0:
        return image_id_map
    
    # Process in batches, but sequentially within each batch
    batch_size = 20
    total_processed = 0
    start_time = time.time()
    last_progress_time = start_time
    
    for i in range(0, len(pages_to_process), batch_size):
        batch = pages_to_process[i:i+batch_size]
        batch_results = []
        
        # Process images sequentially within the batch
        for page_data in batch:
            try:
                image_id = page_data.get("id")
                image_path = page_data.get("image_path")
                parent_meta_element_id = page_data.get("parent_id")
                
                if image_path.startswith('/'):
                    image_path = image_path[1:]
                
                absolute_image_path = os.path.join(project_root, image_path)
                image_name = os.path.basename(image_path)
                
                try:
                    async with aiofiles.open(absolute_image_path, mode="rb") as f:
                        raw_image_data = await f.read()
                except FileNotFoundError:
                    logger.warning(f"WARNING: Image file not found: {absolute_image_path}")
                    continue
                
                # Extract metadata
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
                
                # Create a new session for this specific operation
                async with db.begin():
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
                        
                        # Update tracking data
                        image_id_map[str(image_id)] = image_id
                        success_counters["images"] += 1
                        
                    except Exception as e:
                        logger.warning(f"WARNING: Failed to save image {image_id}: {str(e)}")
            except Exception as e:
                logger.warning(f"WARNING: Error processing image {page_data.get('id')}: {str(e)}")
        
        total_processed += len(batch)
        current_time = time.time()
        
        # Only log progress if more than 2 seconds have passed or it's the final batch
        if current_time - last_progress_time > 2 or total_processed >= total_to_process:
            progress = (total_processed / total_to_process) * 100
            images_per_second = total_processed / (current_time - start_time)
            eta_seconds = (total_to_process - total_processed) / max(1, images_per_second)
            
            # Format ETA nicely
            if eta_seconds < 60:
                eta_str = f"{eta_seconds:.1f}s"
            elif eta_seconds < 3600:
                eta_str = f"{eta_seconds/60:.1f}m"
            else:
                eta_str = f"{eta_seconds/3600:.1f}h"
                
            logger.info(f"  • Progress: {progress:.1f}% ({total_processed}/{total_to_process}) - {images_per_second:.1f} img/s - ETA: {eta_str}")
            last_progress_time = current_time
    
    images_verified = len(image_id_map)
    success_rate = (images_verified / total_to_process) * 100 if total_to_process > 0 else 0
    logger.info(f"Image processing complete: {images_verified}/{total_to_process} images ({success_rate:.1f}%)")
    
    return image_id_map



async def _process_meta_elements_optimized(db: AsyncSession, metakat_data: dict, collection_id: UUID, success_counters: dict):
    """Process all meta elements with batch insertion for better performance with large datasets"""
    from metacheck.cruds import crud_meta_element
    from metacheck.constants import META_ELEMENT_TYPE_IDS
    
    logger.info("Processing meta elements in hierarchical order (batch optimized)...")
    
    # Define the correct hierarchical order for processing elements
    element_processing_order = ["titles", "volumes", "issues", "chapters", "articles", "supplements"]
    
    # Track possible root elements
    title_id = None
    volume_id = None
    
    for element_type in element_processing_order:
        if element_type not in metakat_data or not metakat_data[element_type]:
            logger.info(f"{element_type.capitalize()}: None to process")
            continue
            
        element_count = len(metakat_data[element_type])
        logger.info(f"{element_type.capitalize()}: Processing {element_count}...")
        
        element_type_singular = element_type[:-1]  # Remove 's' to get singular form
        meta_element_type_id = META_ELEMENT_TYPE_IDS.get(element_type_singular)
        
        if not meta_element_type_id:
            logger.warning(f"WARNING: No meta element type ID found for {element_type_singular}, skipping")
            continue
        
        # Initialize counter if not exists
        if element_type not in success_counters:
            success_counters[element_type] = 0
        
        # Before batch operations, identify existing elements and check parents
        async with db.begin():
            element_ids = [element_data.get("id") for element_data in metakat_data[element_type] if element_data.get("id")]
            if not element_ids:
                logger.warning(f"WARNING: No valid IDs found for {element_type}, skipping")
                continue
                
            # Get all existing elements in one query
            existing_elements_query = await db.execute(
                select(model.MetaElement.id).filter(model.MetaElement.id.in_(element_ids))
            )
            existing_element_ids = {str(id) for id, in existing_elements_query.unique()}
            
            # Find first potential root element
            if element_type == "titles" and not title_id:
                for element_data in metakat_data[element_type]:
                    if not element_data.get("parent_id"):
                        title_id = element_data.get("id")
                        if title_id:
                            logger.info(f"Found title element as possible root: {title_id}")
                            break
            
            elif element_type == "volumes" and not volume_id:
                for element_data in metakat_data[element_type]:
                    if not element_data.get("parent_id"):
                        volume_id = element_data.get("id")
                        if volume_id:
                            logger.info(f"Found volume element as possible root: {volume_id}")
                            break
            
            # Also check parent references in advance
            parent_ids = {element_data.get("parent_id") for element_data in metakat_data[element_type] 
                          if element_data.get("parent_id")}
            parent_ids = {pid for pid in parent_ids if pid}  # Remove None
            
            if parent_ids:
                parent_check_query = await db.execute(
                    select(model.MetaElement.id).filter(model.MetaElement.id.in_(parent_ids))
                )
                existing_parent_ids = {str(id) for id, in parent_check_query.unique()}
            else:
                existing_parent_ids = set()
        
        # Process elements in batches of 100
        batch_size = 100
        elements_to_create = []
        progress_interval = max(1, element_count // 5)  # Report progress at 20%, 40%, 60%, 80%, 100%
        
        for idx, element_data in enumerate(metakat_data[element_type], 1):
            element_id = element_data.get("id")
            if not element_id:
                logger.warning(f"WARNING: Found {element_type_singular} without ID, skipping")
                continue
                
            # Skip if element already exists
            if element_id in existing_element_ids:
                success_counters[element_type] += 1
                continue
                
            # Verify parent exists if parent_id is provided
            parent_id = element_data.get("parent_id")
            if parent_id and parent_id not in existing_parent_ids:
                logger.debug(f"Parent element {parent_id} for {element_type_singular} {element_id} does not exist, creating with no parent")
                parent_id = None
                
            # Filter out fields that are not attributes
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
                # Keep primitive values
                if v is None or isinstance(v, (bool, int, float, str)):
                    attributes[k] = v
            
            # Create model instance
            db_element = model.MetaElement(
                id=element_id,
                collection_id=collection_id,
                meta_element_type_id=meta_element_type_id,
                parent_id=parent_id,
                attributes=attributes
            )
            elements_to_create.append(db_element)
            
            # Show progress periodically
            if idx % progress_interval == 0 or idx == element_count:
                progress = (idx / element_count) * 100
                logger.info(f"  • Progress: {progress:.1f}% ({idx}/{element_count})")
            
            # When batch size is reached, execute batch insert
            if len(elements_to_create) >= batch_size:
                await _batch_create_meta_elements(db, elements_to_create, success_counters, element_type)
                elements_to_create = []
                
        # Process any remaining elements
        if elements_to_create:
            await _batch_create_meta_elements(db, elements_to_create, success_counters, element_type)
        
        logger.info(f"{element_type.capitalize()} completed: {success_counters[element_type]}/{element_count} elements processed")
    
    # After processing all elements, set the root element
    await find_and_set_root_meta_element(db, collection_id, title_id, volume_id)
    
    # Return the chosen root element for reference
    return title_id or volume_id


async def _process_detections_in_batches(db: AsyncSession, metakat_data: dict, collection_id: UUID, image_id_map: dict, success_counters: dict):
    """Process detections in batches for better performance"""
    import time
    logger.info("Processing detections in batches...")
    
    regular_detections = metakat_data.get("detections", [])
    
    verification_stats = {
        "total_detections": len(regular_detections),
        "success": 0,
        "failed": 0
    }
    
    if verification_stats["total_detections"] == 0:
        logger.info("No detections to process")
        return verification_stats
    
    logger.info(f"Processing {len(regular_detections)} detections in batches")
    
    # Load all meta roles first for lookup
    async with db.begin():
        meta_roles_query = await db.execute(select(model.MetaRole))
        meta_roles = meta_roles_query.unique().scalars().all()
        
        meta_roles_by_name = {}
        for role in meta_roles:
            if hasattr(role, 'computed_name'):
                meta_roles_by_name[role.computed_name] = role.id
        
        logger.info(f"Loaded {len(meta_roles_by_name)} meta roles for classification")
        
        # Check which detections already exist
        detection_ids = [d.get("id") for d in regular_detections if d.get("id")]
        existing_detections_query = await db.execute(
            select(model.Detection.id).filter(model.Detection.id.in_(detection_ids))
        )
        existing_detection_ids = {str(id) for id, in existing_detections_query.unique()}
        logger.info(f"Found {len(existing_detection_ids)} detections that already exist")
        
        # Find all existing images in advance
        all_image_ids = {d.get("page_id") or d.get("image_id") for d in regular_detections 
                         if d.get("page_id") or d.get("image_id")}
        all_image_ids = {img_id for img_id in all_image_ids if img_id}
        
        if all_image_ids:
            existing_images_query = await db.execute(
                select(model.Image.id).filter(model.Image.id.in_(all_image_ids))
            )
            existing_image_ids = {str(id) for id, in existing_images_query.unique()}
            logger.info(f"Found {len(existing_image_ids)} referenced images that exist")
        else:
            existing_image_ids = set()
    
    # Process in batches
    total_detections = len(regular_detections)
    batch_size = 100
    detection_batches = []
    meta_element_detection_batches = []
    processed_count = 0
    start_time = time.time()
    last_progress_time = start_time
    
    for idx, detection in enumerate(regular_detections, 1):
        try:
            detection_dict = detection.copy()
            detection_id = detection_dict.get("id")
            
            # Skip if detection already exists
            if detection_id in existing_detection_ids:
                success_counters["detections"] += 1
                verification_stats["success"] += 1
                processed_count += 1
                continue
            
            image_id = detection_dict.get("page_id") or detection_dict.get("image_id")
            
            if not image_id or str(image_id) not in existing_image_ids:
                verification_stats["failed"] += 1
                processed_count += 1
                continue
            
            # Create detection object
            db_detection = model.Detection(
                id=detection_id,
                image_id=str(image_id),
                bbox=detection_dict.get("bbox"),
                value=detection_dict.get("value"),
                confidence=detection_dict.get("confidence")
            )
            detection_batches.append(db_detection)
            
            # Create meta element detection if applicable
            meta_element_id = detection_dict.get("parent_element_id")
            meta_element_type = detection_dict.get("element_type")
            meta_attribute_type = detection_dict.get("meta_attribute_type")
            
            if meta_element_id and meta_element_type and meta_attribute_type:
                computed_name = f"{meta_element_type}.{meta_attribute_type}"
                meta_role_id = meta_roles_by_name.get(computed_name)
                
                if meta_role_id:
                    db_meta_element_detection = model.MetaElementDetection(
                        id=uuid.uuid4(),
                        detection_id=detection_id,
                        meta_element_id=meta_element_id,
                        meta_role_id=meta_role_id
                    )
                    meta_element_detection_batches.append(db_meta_element_detection)
                    success_counters["meta_element_detections"] += 1
            
            # Show progress periodically
            current_time = time.time()
            if idx % batch_size == 0 or idx == total_detections:
                progress = (idx / total_detections) * 100
                detections_per_second = idx / (current_time - start_time)
                eta_seconds = (total_detections - idx) / max(1, detections_per_second)
                
                # Format ETA nicely
                if eta_seconds < 60:
                    eta_str = f"{eta_seconds:.1f}s"
                elif eta_seconds < 3600:
                    eta_str = f"{eta_seconds/60:.1f}m"
                else:
                    eta_str = f"{eta_seconds/3600:.1f}h"
                    
                logger.info(f"  • Progress: {progress:.1f}% ({idx}/{total_detections}) - {detections_per_second:.1f} det/s - ETA: {eta_str}")
                last_progress_time = current_time
            
            # When batch size is reached, execute batch insert
            if len(detection_batches) >= batch_size:
                detection_count = len(detection_batches)
                meta_detection_count = len(meta_element_detection_batches)
                logger.info(f"  • Inserting batch: {detection_count} detections, {meta_detection_count} meta links")
                
                await _batch_insert_detections(db, detection_batches, meta_element_detection_batches, 
                                             verification_stats, success_counters)
                processed_count += detection_count
                detection_batches = []
                meta_element_detection_batches = []
        
        except Exception as e:
            detection_id = detection.get("id", "unknown")
            logger.warning(f"WARNING: Failed to process detection {detection_id}: {e}")
            verification_stats["failed"] += 1
            processed_count += 1
    
    # Process any remaining batches
    if detection_batches:
        detection_count = len(detection_batches)
        meta_detection_count = len(meta_element_detection_batches)
        logger.info(f"  • Inserting final batch: {detection_count} detections, {meta_detection_count} meta links")
        
        await _batch_insert_detections(db, detection_batches, meta_element_detection_batches, 
                                     verification_stats, success_counters)
        processed_count += detection_count
    
    # Final summary
    success_rate = (verification_stats["success"] / total_detections) * 100 if total_detections > 0 else 0
    logger.info(f"Detection processing complete: {verification_stats['success']}/{total_detections} detections ({success_rate:.1f}%)")
    if verification_stats["failed"] > 0:
        logger.warning(f"WARNING: {verification_stats['failed']} detections failed to process")
    
    return verification_stats


async def _batch_insert_detections(db: AsyncSession, detection_batch: list, meta_element_detection_batch: list, 
                                verification_stats: dict, success_counters: dict):
    """Insert a batch of detections and meta element detections using efficient bulk operations"""
    try:
        async with db.begin():
            # Create copies to avoid affecting the original lists
            detections_to_insert = list(detection_batch)
            meta_detections_to_insert = list(meta_element_detection_batch) if meta_element_detection_batch else []
            
            # Log the attempt for monitoring
            batch_size = len(detections_to_insert)
            meta_batch_size = len(meta_detections_to_insert)
            logger.info(f"Attempting bulk insert of {batch_size} detections and {meta_batch_size} meta element detections")
            
            # Use SQLAlchemy's bulk_save_objects for detections
            if detections_to_insert:
                await db.run_sync(
                    lambda session: session.bulk_save_objects(
                        detections_to_insert,
                        return_defaults=False  # Improve performance as we already have IDs
                    )
                )
            
            # Use SQLAlchemy's bulk_save_objects for meta element detections
            if meta_detections_to_insert:
                await db.run_sync(
                    lambda session: session.bulk_save_objects(
                        meta_detections_to_insert,
                        return_defaults=False  # Improve performance as we already have IDs
                    )
                )
            
            # Update counters
            success_counters["detections"] += batch_size
            verification_stats["success"] += batch_size
            
            logger.info(f"Bulk inserted {batch_size} detections and {meta_batch_size} meta element detections")
            
    except Exception as e:
        logger.warning(f"Bulk detection insert failed: {str(e)}")
        logger.info("Falling back to individual detection insert")
        verification_stats["failed"] += len(detection_batch)
        
        # Fallback to individual inserts with careful error handling
        individual_success = 0
        individual_meta_success = 0
        
        # Try individual inserts as fallback
        for i, detection in enumerate(detection_batch):
            try:
                async with db.begin():
                    # Add the detection
                    db.add(detection)
                    
                    # Add the corresponding meta element detection if available
                    if i < len(meta_element_detection_batch):
                        db.add(meta_element_detection_batch[i])
                        individual_meta_success += 1
                
                # Update counters only on success
                success_counters["detections"] += 1
                verification_stats["success"] += 1
                verification_stats["failed"] -= 1  # Correct the earlier assumption that all failed
                individual_success += 1
                
            except Exception as e2:
                logger.warning(f"Failed to insert individual detection {detection.id}: {str(e2)}")
        
        logger.info(f"Fallback completed: inserted {individual_success}/{len(detection_batch)} detections " +
                   f"and {individual_meta_success}/{len(meta_element_detection_batch) if meta_element_detection_batch else 0} meta element detections")


async def find_and_set_root_meta_element(db: AsyncSession, collection_id: UUID, title_id=None, volume_id=None):
    """Set the root meta element for a collection.
    
    Args:
        db: Database session
        collection_id: Collection ID
        title_id: ID of a title element (first priority)
        volume_id: ID of a volume element (second priority)
        
    Returns:
        bool: True if a root element was set, False otherwise
    """
    try:
        if title_id:
            # Set title as root element (first priority)
            async with db.begin():
                await db.execute(
                    update(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .values(root_meta_element_id=title_id)
                )
            logger.info(f"Set title element {title_id} as root for collection {collection_id}")
            return True
            
        if volume_id:
            # Set volume as root element (second priority)
            async with db.begin():
                await db.execute(
                    update(model.Collection)
                    .where(model.Collection.id == collection_id)
                    .values(root_meta_element_id=volume_id)
                )
            logger.info(f"Set volume element {volume_id} as root for collection {collection_id}")
            return True
            
        # If we got here, no root element was set
        logger.warning(f"No suitable root element found for collection {collection_id}")
        return False
        
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed to set root meta element for collection {collection_id}")
        return False


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


async def _batch_create_meta_elements(db: AsyncSession, elements: list, success_counters: dict, element_type: str):
    """Create meta elements in batches using bulk insert operations for better performance"""
    try:
        # Use the bulk_save_objects method for more efficient insertion
        async with db.begin():
            # Create a shallow copy of the elements list to avoid affecting the original
            elements_to_insert = list(elements)
            
            # Log the attempt for monitoring
            logger.info(f"Attempting bulk insert of {len(elements_to_insert)} {element_type} elements")
            
            # Use SQLAlchemy's bulk_save_objects for efficient insertion
            # Setting return_defaults=False further improves performance as we already have IDs
            await db.run_sync(
                lambda session: session.bulk_save_objects(
                    elements_to_insert, 
                    return_defaults=False
                )
            )
            
            # Update success counter
            success_counters[element_type] += len(elements_to_insert)
            logger.info(f"Successfully bulk inserted {len(elements_to_insert)} {element_type}")
            
    except Exception as e:
        logger.warning(f"Bulk insert failed for {element_type}: {str(e)}")
        logger.info("Falling back to individual element creation")
        
        # If bulk insert fails, fall back to individual inserts as a safety mechanism
        successful_inserts = 0
        for element in elements:
            try:
                async with db.begin():
                    db.add(element)
                success_counters[element_type] += 1
                successful_inserts += 1
            except Exception as e2:
                logger.warning(f"Failed to create individual {element_type} {element.id}: {str(e2)}")
                
        logger.info(f"Fallback completed: inserted {successful_inserts}/{len(elements)} elements")