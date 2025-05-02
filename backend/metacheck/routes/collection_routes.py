import logging
from uuid import UUID

from fastapi import Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_collection, crud_general
from metacheck.database import get_async_session
from metacheck.routes import collection_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

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

@collection_route.get(
    "/{collection_id}/images",
    response_model=list[base_objects.Image],
    tags=["Collection"],
)
async def get_collection_images(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    """Get all images belonging to a specific collection"""
    return await crud_collection.get_collection_images(db, collection_id)


@collection_route.post("/import_yolo", tags=["Import"])
async def import_collection_yolo(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    """Import a YOLO formatted dataset"""
    return await crud_collection.import_yolo_collection(file, db)


@collection_route.post("/import_metakat", tags=["Import"])
async def import_collection_metakat(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    """Import a MetaKat formatted dataset"""
    return await crud_collection.import_metakat_collection(file, db)


@collection_route.get(
    "/{collection_id}/full",
    response_model=base_objects.Collection,
    tags=["Collection"],
)
async def get_collection_full(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    """Get a collection with all its images and meta_elements explicitly loaded"""
    # Get the collection with images and meta_elements
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(model.Collection).where(model.Collection.id == collection_id)
    query = query.options(
        selectinload(model.Collection.images),
        selectinload(model.Collection.meta_elements)
    )
    
    async with db.begin():
        result = await db.execute(query)
        collection = result.unique().scalar_one_or_none()
        
        if not collection:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
        
        # Convert to dictionary with all relationships
        collection_dict = crud_general.sqlalchemy_to_dict(collection)
        
        # Return Pydantic model
        return base_objects.Collection.model_validate(collection_dict)



@collection_route.get(
    "/{collection_id}/hierarchical",
    response_model=base_objects.CollectionHierarchical,
    tags=["Collection"],
)
async def get_collection_hierarchical(
    collection_id: UUID, 
    use_cache: bool = True,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get a collection with all its images and meta_elements in a hierarchical structure.
    
    Parameters:
    - collection_id: The UUID of the collection
    - use_cache: Whether to use the cached structure (default: True)
    """
    return await crud_collection.get_collection_hierarchical(db, collection_id, use_cache)


@collection_route.get(
    "/{collection_id}/hierarchical-structure",
    tags=["Collection"],
)
async def get_hierarchical_structure(
    collection_id: UUID, 
    use_cache: bool = True,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get only the hierarchical structure from a collection.
    
    This endpoint returns just the hierarchical structure without the collection metadata,
    which can be more efficient when only the structure is needed.
    
    Parameters:
    - collection_id: The UUID of the collection
    - use_cache: Whether to use the cached structure (default: True)
    """
    # Get the full collection
    collection = await crud_collection.get_collection(db, collection_id)
    
    # Return only the global_structure part
    if collection and hasattr(collection, 'global_structure'):
        return {"global_structure": collection.global_structure}
    
    # If there's no global structure, return an empty one
    return {"global_structure": None}


@collection_route.get(
    "/debug/{collection_id}/cache-status",
    tags=["Collection", "Diagnostics"],
)
async def check_collection_cache_status(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    """
    Diagnostic endpoint to check the status of the hierarchical cache for a collection.
    
    This endpoint is useful for debugging caching issues.
    
    Parameters:
    - collection_id: The UUID of the collection to check
    
    Returns:
    - A dictionary with information about the cache status
    """
    return await crud_collection.check_hierarchical_cache_status(db, collection_id)


@collection_route.get(
    "/debug/schema-check",
    tags=["Collection", "Diagnostics"],
)
async def check_collection_schema(
    db: AsyncSession = Depends(get_async_session)
):
    """
    Diagnostic endpoint to verify the database schema for collections table.
    
    This helps debug issues with column existence and migrations.
    """
    try:
        from sqlalchemy import text
        
        # Check if the column exists in the SQLAlchemy model
        has_column_in_model = hasattr(model.Collection, 'hierarchical_structure')
        
        # Direct SQL approach for compatibility with AsyncEngine
        columns_query = text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'collections'
        """)
        result = await db.execute(columns_query)
        columns = result.fetchall()
        column_names = [col[0] for col in columns]
        column_types = {col[0]: col[1] for col in columns}
        
        # Direct SQL check for the JSONB column
        raw_query = text("SELECT column_name FROM information_schema.columns WHERE table_name = 'collections' AND column_name = 'hierarchical_structure'")
        result = await db.execute(raw_query)
        sql_check = result.scalar_one_or_none() is not None
        
        # Check column type if it exists
        column_type = column_types.get('hierarchical_structure', 'not found')
        
        # Check if column can store JSONB data
        is_jsonb = column_type == 'jsonb'
        
        # Check table structure
        table_query = text("SELECT table_name FROM information_schema.tables WHERE table_name = 'collections'")
        table_result = await db.execute(table_query)
        table_exists = table_result.scalar_one_or_none() is not None
        
        # Try a sample update with empty JSON to check permissions
        can_update = False
        try:
            # Get a random collection ID
            id_query = text("SELECT id FROM collections LIMIT 1")
            id_result = await db.execute(id_query)
            test_id = id_result.scalar_one_or_none()
            
            if test_id:
                # Try updating with empty JSON
                test_update = text("UPDATE collections SET hierarchical_structure = '{}'::jsonb WHERE id = :id")
                await db.execute(test_update, {"id": str(test_id)})
                await db.commit()
                can_update = True
        except Exception as update_e:
            can_update = False
        
        # Return all diagnostic information
        return {
            "has_column_in_model": has_column_in_model,
            "column_names_in_db": column_names,
            "hierarchical_structure_in_db": "hierarchical_structure" in column_names,
            "hierarchical_structure_type": column_type,
            "is_jsonb_type": is_jsonb,
            "can_update_jsonb": can_update,
            "sql_check_result": sql_check,
            "table_exists": table_exists,
            "message": "Column exists and appears correct" if "hierarchical_structure" in column_names and is_jsonb else "Column missing or has wrong type in database schema"
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": f"Error checking schema: {str(e)}",
            "traceback": traceback.format_exc()
        }

@collection_route.post(
    "/debug/{collection_id}/update-cache",
    tags=["Collection", "Diagnostics"],
)
async def update_collection_cache(
    collection_id: UUID, 
    db: AsyncSession = Depends(get_async_session)
):
    """
    Diagnostic endpoint to force cache update using direct SQL.
    
    This is a fallback for debugging cache storage issues.
    """
    try:
        # Get the full hierarchical structure
        hierarchical = await crud_collection.get_collection_hierarchical(db, collection_id, use_cache=False)
        
        if not hierarchical:
            return {"status": "error", "message": "Failed to build hierarchical structure"}
        
        # Convert to JSON-safe dictionary
        import json
        from datetime import datetime
        from uuid import UUID
        
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
        
        # Convert to JSON-safe dictionary
        json_safe_dict = convert_to_json_safe(hierarchical.model_dump())
        
        # Calculate size
        json_string = json.dumps(json_safe_dict)
        size_kb = len(json_string) / 1024
        
        # Check if the column exists
        from sqlalchemy import text
        column_query = text("SELECT data_type FROM information_schema.columns WHERE table_name = 'collections' AND column_name = 'hierarchical_structure'")
        column_result = await db.execute(column_query)
        column_type = column_result.scalar_one_or_none()
        
        if not column_type:
            # Column doesn't exist, try to create it
            try:
                create_column = text("ALTER TABLE collections ADD COLUMN hierarchical_structure JSONB")
                await db.execute(create_column)
                await db.commit()
                column_type = "jsonb (newly created)"
            except Exception as create_e:
                return {
                    "status": "error",
                    "message": f"Column doesn't exist and couldn't be created: {str(create_e)}",
                    "next_steps": "Try running migrations: 'cd backend && python -m alembic upgrade head'"
                }
        
        # Try direct SQL update
        try:
            # Use a parameterized query with proper JSONB casting for PostgreSQL
            sql = text("UPDATE collections SET hierarchical_structure = :structure::jsonb WHERE id = :id")
            params = {"structure": json_string, "id": str(collection_id)}
            await db.execute(sql, params)
            await db.commit()
            
            # Verify update with a separate query
            verify_query = text("SELECT hierarchical_structure IS NOT NULL FROM collections WHERE id = :id")
            verify_result = await db.execute(verify_query, {"id": str(collection_id)})
            is_updated = verify_result.scalar_one_or_none()
            
            # Try retrieving the stored value
            retrieve_query = text("SELECT hierarchical_structure FROM collections WHERE id = :id")
            retrieve_result = await db.execute(retrieve_query, {"id": str(collection_id)})
            stored_data = retrieve_result.scalar_one_or_none()
            
            return {
                "status": "success" if is_updated else "error",
                "size_kb": size_kb,
                "column_type": column_type,
                "is_updated": is_updated,
                "has_stored_data": stored_data is not None,
                "stored_data_type": type(stored_data).__name__ if stored_data is not None else None,
                "message": "Cache updated successfully and verified" if is_updated else "Failed to update cache"
            }
        except Exception as update_e:
            return {
                "status": "error",
                "message": f"Update failed with error: {str(update_e)}",
                "column_type": column_type,
                "json_size_kb": size_kb,
                "error_details": str(update_e)
            }
        
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": f"Error preparing cache update: {str(e)}",
            "traceback": traceback.format_exc()
        }

@collection_route.get(
    "/{collection_id}/stored-structure",
    tags=["Collection"],
)
async def get_stored_hierarchical_structure(
    collection_id: UUID, 
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get the raw hierarchical_structure directly from the database.
    
    This endpoint returns the pre-calculated hierarchical structure stored in the database
    without any additional processing or rebuilding.
    
    Parameters:
    - collection_id: The UUID of the collection
    """
    from sqlalchemy import select
    
    # Direct query to get just the hierarchical_structure column
    query = select(model.Collection.hierarchical_structure).where(model.Collection.id == collection_id)
    
    try:
        result = await db.execute(query)
        hierarchical_structure = result.scalar_one_or_none()
        
        if hierarchical_structure is None:
            # Check if collection exists but has no structure
            exists_query = select(model.Collection.id).where(model.Collection.id == collection_id)
            exists_result = await db.execute(exists_query)
            collection_exists = exists_result.scalar_one_or_none() is not None
            
            if not collection_exists:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
            
            # Collection exists but has no structure
            return {"hierarchical_structure": None}
        
        # Return the structure directly
        return {"hierarchical_structure": hierarchical_structure}
        
    except Exception as e:
        from fastapi import HTTPException
        logger.error(f"Error fetching stored hierarchical structure: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve hierarchical structure: {str(e)}")

@collection_route.get(
    "/{collection_id}/structure",
    tags=["Collection"],
)
async def get_structure(
    collection_id: UUID, 
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get just the hierarchical_structure attribute from the collection.
    """
    from sqlalchemy import select
    
    # Get the collection
    query = select(model.Collection).where(model.Collection.id == collection_id)
    result = await db.execute(query)
    collection = result.scalar_one_or_none()
    
    if not collection:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Collection with ID {collection_id} not found")
    
    # Return the hierarchical_structure attribute directly
    return collection.hierarchical_structure