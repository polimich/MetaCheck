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


def sqlalchemy_to_dict(obj, visited=None):
    """
    Direct approach to convert SQLAlchemy objects to dictionaries with
    special handling for self-referential relationships and async safety.
    
    Args:
        obj: SQLAlchemy ORM object
        visited: Set of already visited object IDs to prevent circular references
        
    Returns:
        Dictionary representation with proper handling of relationships
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
    
    # CRITICAL: Only access attributes that are already in __dict__
    # This prevents triggering lazy loads which require async context
    obj_dict = obj.__dict__
    
    # Get class name for type-specific handling
    class_name = obj.__class__.__name__
    
    # Determine which relationships are already loaded
    # Skip SQLAlchemy internal attributes that start with _
    for key, value in obj_dict.items():
        if key.startswith('_') or key in result:
            continue
            
        # Skip if not a proper relationship
        if not hasattr(obj.__class__, key):
            continue
            
        attr = getattr(obj.__class__, key)
        if not hasattr(attr, 'prop'):
            continue
            
        # Handle different relationship types safely
        if value is None:
            result[key] = None
            continue
            
        # Special handling for MetaElement parent/children to prevent circular refs
        if class_name == 'MetaElement' and key in ('parent', 'children'):
            if key == 'parent':
                # For parent, include basic info without going deeper
                if value is not None:
                    parent_dict = orm2dict(value)
                    result[key] = parent_dict
            elif key == 'children':
                # For children, include basic info for each child
                if value:
                    result[key] = [orm2dict(child) for child in value]
        # Special handling for Image-MetaElement relationship
        elif class_name == 'Image' and key == 'parent_meta_element':
            if value is not None:
                result[key] = {
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
        # Special handling for MetaElement-Image relationship
        elif class_name == 'MetaElement' and key == 'image':
            if value is not None:
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
                    "imagehash": getattr(value, 'imagehash', ""),
                    "work_state": getattr(value, 'work_state', "new"),
                    "detection_count": getattr(value, 'detection_count', 0),
                    "annotated_detection_count": getattr(value, 'annotated_detection_count', 0)
                }
                
                # Add page_index relationship if it exists
                page_index = getattr(value, 'page_index', None)
                if page_index is not None:
                    image_dict["page_index"] = {
                        "id": getattr(page_index, 'id', None),
                        "created_date": getattr(page_index, 'created_date', None),
                        "last_change": getattr(page_index, 'last_change', None),
                        "last_access": getattr(page_index, 'last_access', None),
                        "deleted": getattr(page_index, 'deleted', False)
                    }
                else:
                    image_dict["page_index"] = None
                
                result[key] = image_dict
        # For regular relationships
        elif isinstance(value, list):
            # List relationships
            if value:
                result[key] = [sqlalchemy_to_dict(item, visited.copy()) for item in value]
            else:
                result[key] = []
        else:
            # Single object relationships
            result[key] = sqlalchemy_to_dict(value, visited.copy())
    
    return result


async def get_all(
    db: AsyncSession,
    model_class: Type[T],
    table: model.Base,
    limit: int = 1000,
) -> List[T]:
    try:
        async with db.begin():
            # Build and execute the query
            query = select(table).order_by(table.created_date.desc()).limit(limit)
            db_objects = await db.execute(query)
            db_objects = db_objects.unique().scalars().all()
            
            # Convert SQLAlchemy objects to dictionaries with relationships
            result = []
            for obj in db_objects:
                # Use our direct conversion approach
                obj_dict = sqlalchemy_to_dict(obj)
                result.append(model_class.model_validate(obj_dict))
            
            return result
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching objects from database: {str(e)}")
        raise DBError(f"Failed fetching objects from database: {str(e)}") from e


async def get(
    db: AsyncSession, 
    model_class: Type[T], 
    table: model.Base, 
    id: UUID,
) -> T:
    try:
        async with db.begin():
            # Simple query with ID filter
            query = select(table).where(table.id == id)
            db_object = await db.execute(query)
            db_object = db_object.unique().scalar()
            
            if db_object is None:
                raise exc.SQLAlchemyError(f"Object with ID={id} not found")
                
            # Use our direct conversion approach
            obj_dict = sqlalchemy_to_dict(db_object)
            return model_class.model_validate(obj_dict)
    except exc.SQLAlchemyError as e:
        logging.exception(
            f"Failed fetching object from database. Object does not exist. ID={id}"
        )
        raise DBError(
            f"Failed fetching object from database. Object does not exist. ID={id}"
        ) from e


async def get_or_none(
    db: AsyncSession, 
    model_class: Type[T], 
    table: model.Base, 
    id: UUID,
) -> Union[T, None]:
    try:
        async with db.begin():
            # Simple query with ID filter
            query = select(table).where(table.id == id)
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
    try:
        async with db.begin():
            data = obj.model_dump(exclude={"id"}, exclude_none=exclude_none)
            stm = update(table).where(table.id == obj.id).values(data)
            await db.execute(stm)
    except exc.SQLAlchemyError as e:
        logging.exception(f"Failed updating object in database.")
        raise DBError(f"Failed updating object in database.") from e


async def delete_obj(db: AsyncSession, id: UUID, table: model.Base):
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
