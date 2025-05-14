import json
import logging
from typing import List, Union, Type, TypeVar, Dict, Any, Set
from uuid import UUID

from sqlalchemy import exc, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect
from pydantic import BaseModel

from db import model
from db.model.base import orm2dict
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Type variable for Pydantic models
T = TypeVar('T', bound=BaseModel)

# Author: Michael Polívka xpoliv07
# Summary: General purpose CRUD operations and utility functions for database interaction and object conversion.
# Provides functions for retrieving, creating, updating, and deleting database objects, as well as converting SQLAlchemy objects to dictionaries with proper handling of relationships.

def sqlalchemy_to_dict(obj, visited=None):
    """
    Converts SQLAlchemy objects to dictionaries, handling relationships and preventing circular references.
    Safely extracts column values and includes specified relationships.
    """
    if obj is None:
        return None
        
    # Initialize visited set if not provided
    if visited is None:
        visited = set()
        
    # For lists/collections, handle each item separately
    if isinstance(obj, list):
        return [sqlalchemy_to_dict(item, visited) for item in obj]
        
    # Get object ID for reference checks
    obj_id = getattr(obj, 'id', None)
    
    # Check if we've already visited this object to prevent circular references
    if obj_id and str(obj_id) in visited:
        # Return just a basic reference to avoid circular recursion
        return {"id": obj_id, "reference_only": True}
    
    # Mark this object as visited
    if obj_id:
        visited.add(str(obj_id))
    
    # Get base dictionary with column values using orm2dict
    # This safely extracts column values without triggering lazy loads
    try:
        result = orm2dict(obj)
    except Exception as e:
        # Fallback if orm2dict fails
        logger.warning(f"orm2dict failed for {obj.__class__.__name__}: {str(e)}")
        result = {"id": obj_id} if obj_id else {}
    
    # Special handling for Image to always include detections
    class_name = obj.__class__.__name__
    if class_name == 'Image':
        # For Images, we need to ensure detections are included
        try:
            detections = getattr(obj, 'detections', [])
            if detections:
                detections_list = []
                for detection in detections:
                    detection_dict = {
                        "id": getattr(detection, 'id', None),
                        "created_date": getattr(detection, 'created_date', None),
                        "last_change": getattr(detection, 'last_change', None),
                        "last_access": getattr(detection, 'last_access', None),
                        "deleted": getattr(detection, 'deleted', False),
                        "image_id": getattr(detection, 'image_id', None),
                        "bbox": getattr(detection, 'bbox', ""),
                        "value": getattr(detection, 'value', ""),
                        "confidence": getattr(detection, 'confidence', None),
                        "annotated": getattr(detection, 'annotated', False),
                        "computed_color": getattr(detection, 'computed_color', None),
                        "computed_type": getattr(detection, 'computed_type', None),
                        "computed_display_type": getattr(detection, 'computed_display_type', None)
                    }
                    detections_list.append(detection_dict)
                
                result["detections"] = detections_list
            else:
                result["detections"] = []
        except Exception as e:
            logger.warning(f"Error handling Image detections: {str(e)}")
    
    # Special handling for Collection to ensure images and meta_elements are included
    elif class_name == 'Collection':
        try:
            # Handle images relationship
            images = getattr(obj, 'images', [])
            if images:
                images_list = []
                for image in images:
                    # Skip if we've already visited this image to prevent circular references
                    if str(image.id) in visited:
                        continue
                    image_dict = sqlalchemy_to_dict(image, visited.copy())
                    images_list.append(image_dict)
                result["images"] = images_list
            else:
                result["images"] = []
                
            # Handle meta_elements relationship
            meta_elements = getattr(obj, 'meta_elements', [])
            if meta_elements:
                meta_elements_list = []
                for meta_element in meta_elements:
                    # Skip if we've already visited this meta_element to prevent circular references
                    if str(meta_element.id) in visited:
                        continue
                    meta_element_dict = sqlalchemy_to_dict(meta_element, visited.copy())
                    meta_elements_list.append(meta_element_dict)
                result["meta_elements"] = meta_elements_list
            else:
                result["meta_elements"] = []
        except Exception as e:
            logger.warning(f"Error handling Collection relationships: {str(e)}")
    
    # CRITICAL: Only access attributes that are already in __dict__
    # This prevents triggering lazy loads which require async context
    obj_dict = obj.__dict__
    
    # Skip SQLAlchemy internal attributes that start with _
    for key, value in obj_dict.items():
        # Skip SQLAlchemy internal attributes
        if key.startswith('_sa_'):
            continue
            
        # Handle SQLAlchemy loaded relationship attributes
        if key.startswith('_'):
            # This is a SQLAlchemy relationship attribute, get the real name
            real_key = key[1:]  # Remove leading underscore
            
            # Skip if we already handled this relationship (e.g., for Image detections)
            if real_key in result:
                continue
                
            if value is None:
                result[real_key] = None
                continue
                
            # Handle different relationship types based on class and key
            if isinstance(value, list):
                # List relationships (handle lists of objects)
                if value:
                    # For general list handling
                    result[real_key] = [sqlalchemy_to_dict(item, visited.copy()) for item in value]
                else:
                    result[real_key] = []
            else:
                # Single object relationship
                if class_name == 'MetaElement' and real_key == 'parent':
                    # For parent, include basic info without going deeper
                    parent_dict = orm2dict(value)
                    result[real_key] = parent_dict
                elif class_name == 'MetaElement' and real_key == 'image':
                    # Special handling for MetaElement-Image relationship
                    image_dict = {
                        "id": getattr(value, 'id', None),
                        "created_date": getattr(value, 'created_date', None),
                        "last_change": getattr(value, 'last_change', None),
                        "last_access": getattr(value, 'last_access', None), 
                        "deleted": getattr(value, 'deleted', False),
                        "collection_id": getattr(value, 'collection_id', None),
                        "name": getattr(value, 'name', ""),
                        "height": getattr(value, 'height', 0),
                        "width": getattr(value, 'width', 0),
                        "work_state": getattr(value, 'work_state', "new"),
                        "detection_count": getattr(value, 'detection_count', 0),
                        "annotated_detection_count": getattr(value, 'annotated_detection_count', 0)
                    }
                    result[real_key] = image_dict
                elif class_name == 'Image' and real_key == 'parent_meta_element':
                    # Special handling for Image-MetaElement relationship
                    result[real_key] = {
                        "id": getattr(value, 'id', None),
                        "created_date": getattr(value, 'created_date', None),
                        "last_change": getattr(value, 'last_change', None),
                        "last_access": getattr(value, 'last_access', None),
                        "deleted": getattr(value, 'deleted', False),
                        "collection_id": getattr(value, 'collection_id', None),
                        "meta_element_type_id": getattr(value, 'meta_element_type_id', None),
                        "parent_id": getattr(value, 'parent_id', None),
                        "attributes": getattr(value, 'attributes', {})
                    }
                else:
                    # Regular object relationship
                    result[real_key] = sqlalchemy_to_dict(value, visited.copy())
        
    return result


async def get(
    db: AsyncSession, 
    model_class: Type[T], 
    table: model.Base, 
    id: UUID,
) -> Union[T, None]:
    """Retrieve a single object by its ID, with specified relationships loaded separately."""
    try:
        # First step: Get the base object without eager loading
        query = select(table).where(table.id == id)
        db_object_result = await db.execute(query)
        db_object = db_object_result.unique().scalar()
        
        if db_object is None:
            # Object not found - just return None without raising an exception
            logging.warning(f"Object with ID={id} not found")
            return None
        
        # Second step: Load relationships separately
        if table.__name__ == "Collection":
            # Load images
            from sqlalchemy.orm import selectinload
            images_query = select(model.Image).where(model.Image.collection_id == id)
            images_result = await db.execute(images_query)
            images = images_result.unique().scalars().all()
            
            # Set images directly
            db_object.images = images
            
            # Load meta_elements
            meta_elements_query = select(model.MetaElement).where(model.MetaElement.collection_id == id)
            meta_elements_result = await db.execute(meta_elements_query)
            meta_elements = meta_elements_result.unique().scalars().all()
            
            # Set meta_elements directly
            db_object.meta_elements = meta_elements
            
            # For images, load detections separately 
            for img in db_object.images:
                detections_query = select(model.Detection).where(model.Detection.image_id == img.id)
                detections_result = await db.execute(detections_query)
                detections = detections_result.unique().scalars().all()
                img.detections = detections
        
        elif table.__name__ == "Image":
            # Load detections
            detections_query = select(model.Detection).where(model.Detection.image_id == id)
            detections_result = await db.execute(detections_query)
            detections = detections_result.unique().scalars().all()
            
            # Set detections directly
            db_object.detections = detections
        
        # Use our direct conversion approach to create a dictionary without triggering lazy loads
        obj_dict = sqlalchemy_to_dict(db_object)
        
        return model_class.model_validate(obj_dict)
    except exc.SQLAlchemyError as e:
        logging.exception(
            f"Failed fetching object from database due to a database error. ID={id}"
        )
        raise DBError(
            f"Failed fetching object from database due to a database error. ID={id}"
        ) from e


async def get_all(
    db: AsyncSession,
    model_class: Type[T],
    table: model.Base,
    limit: int = 1000,
) -> List[T]:
    """Retrieve all objects of a given type with an optional limit."""
    try:
        async with db.begin():
            # Build the base query
            query = select(table).order_by(table.created_date.desc()).limit(limit)
            
            # Special handling for different model types
            if table.__name__ == "Image":
                from sqlalchemy.orm import selectinload
                from db.model.detection import Detection
                # Explicitly load the detections
                query = query.options(
                    selectinload(table.detections)
                )
            # For Collections, do not load any relationships
            # This removes the eager loading that was causing performance issues
            
            db_objects = await db.execute(query)
            db_objects = db_objects.unique().scalars().all()
            
            # Convert SQLAlchemy objects to dictionaries with relationships
            result = []
            
            # Process objects based on type
            if table.__name__ == "Collection":
                # For collections, use orm2dict which doesn't include relationships
                for obj in db_objects:
                    obj_dict = orm2dict(obj)  # Use orm2dict instead of sqlalchemy_to_dict
                    result.append(model_class.model_validate(obj_dict))
            else:
                # Normal handling for other objects
                for obj in db_objects:
                    obj_dict = sqlalchemy_to_dict(obj)
                    result.append(model_class.model_validate(obj_dict))
            
            return result
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching objects from database: {str(e)}")
        raise DBError(f"Failed fetching objects from database: {str(e)}") from e


async def get_or_none(
    db: AsyncSession, 
    model_class: Type[T], 
    table: model.Base, 
    id: UUID,
) -> Union[T, None]:
    """Retrieve a single object by its ID or return None if not found, with specified relationships eagerly loaded."""
    try:
        async with db.begin():
            # Build the base query with ID filter
            query = select(table).where(table.id == id)
            
            # Special handling for different model types
            if table.__name__ == "Image":
                from sqlalchemy.orm import selectinload
                from db.model.detection import Detection
                # Explicitly load the detections
                query = query.options(
                    selectinload(table.detections)
                )
            elif table.__name__ == "Collection":
                from sqlalchemy.orm import selectinload
                # For Collections, eagerly load both images and meta_elements
                query = query.options(
                    selectinload(table.images).selectinload(model.Image.detections),
                    selectinload(table.meta_elements)
                )
                
            db_object = await db.execute(query)
            db_object = db_object.unique().scalar()
            
            if db_object is None:
                return None
            
            # Use our direct conversion approach
            obj_dict = sqlalchemy_to_dict(db_object)
            
            return model_class.model_validate(obj_dict)
    except exc.SQLAlchemyError as e:
        logging.exception(f"Failed fetching object from database. ID={id}")
        raise DBError(f"Failed fetching object from database. ID={id}") from e


async def new(db: AsyncSession, obj: Dict[str, Any], table: model.Base, start_transaction: bool = True):
    """Create a new object in the database."""
    try:
        if start_transaction:
            async with db.begin():
                db_obj = table(**obj)
                db.add(db_obj)
                await db.commit()
                return db_obj
        else:
            # Use the existing transaction
            db_obj = table(**obj)
            db.add(db_obj)
            # Don't commit here, the transaction will be committed by the caller
            return db_obj
    except exc.SQLAlchemyError as e:
        logging.exception(
            f'Failed adding object to database. Could be that the object already exists. ID={obj["id"]}'
        )
        raise DBError(
            f'Failed adding object to database. Could be that the object already exists. ID={obj["id"]}'
        ) from e


async def update_obj(
    db: AsyncSession, obj: BaseModel, table: model.Base, exclude_none=True
):
    """Update an existing object in the database."""
    try:
        async with db.begin():
            data = obj.model_dump(exclude={"id"}, exclude_none=exclude_none)
            stm = update(table).where(table.id == obj.id).values(data)
            await db.execute(stm)
    except exc.SQLAlchemyError as e:
        logging.exception(f"Failed updating object in database.")
        raise DBError(f"Failed updating object in database.") from e


async def delete_obj(db: AsyncSession, id: UUID, table: model.Base):
    """Delete an object from the database by its ID."""
    try:
        async with db.begin():
            stm = delete(table).where(table.id == id)
            await db.execute(stm)
    except exc.SQLAlchemyError as e:
        logging.exception(
            f"Failed deleting object in database. Object probably does not exist. ID={id}"
        )
        raise DBError(
            f"Failed deleting object in database. Object probably does not exist. ID={id}"
        ) from e
