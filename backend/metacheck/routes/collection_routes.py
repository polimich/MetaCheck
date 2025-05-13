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
    force_rebuild: bool = False,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get a collection with all its images and meta_elements in a hierarchical structure.
    
    Parameters:
    - collection_id: The UUID of the collection
    - use_cache: Whether to use the cached structure (default: True)
    - force_rebuild: Whether to force rebuilding the hierarchical structure (default: False)
    """
    return await crud_collection.get_collection_hierarchical(db, collection_id, use_cache, force_rebuild)


@collection_route.get(
    "/{collection_id}/hierarchical_tree",
    tags=["Collection"],
)
async def get_collection_hierarchical_tree_endpoint(
    collection_id: UUID, 
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get a collection's hierarchical structure organized as a tree with detections arranged by role.
    
    This endpoint returns a tree structure optimized for frontend display where detections are
    organized by their meta roles (title, author, etc.) rather than by the images they belong to.
    
    The hierarchy is maintained through the structure:
    - Root element: Contains metadata fields and possibly volumes list
    - Volumes: Contains metadata fields and possibly issues list
    - Issues: Contains metadata fields
    
    For each node in the tree, detections are organized by role (title, author, etc.).
    
    Example structure:
    ```
    {
        "id": "uuid",
        "type": "title",
        "periodical": false,
        "title": Detection,
        "author": [Detection, Detection],
        "volumes": [
            {
                "id": "uuid",
                "type": "volume",
                "title": Detection,
                "issues": [
                    {
                        "id": "uuid",
                        "type": "issue",
                        "title": Detection,
                        "issueNumber": Detection
                    }
                ]
            }
        ]
    }
    ```
    
    Returns:
        A hierarchical tree object ready for frontend rendering
    """
    return await crud_collection.get_collection_hierarchical_tree(db, collection_id)
