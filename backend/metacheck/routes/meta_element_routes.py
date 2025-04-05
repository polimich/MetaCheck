import logging
from typing import Dict, List, Any
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general, crud_meta_element
from metacheck.database import get_async_session, DBError
from metacheck.routes import meta_element_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=meta_element_route,
    schema=base_objects.MetaElement,
    schema_new=base_objects.MetaElementNew,
    schema_update=base_objects.MetaElementUpdate,
    model_class=model.MetaElement,
    prefix="meta_element",
    tags=["MetaElement"],
)


@meta_element_route.get(
    "/tree/{collection_id}",
    response_model=List[Dict[str, Any]],
    tags=["MetaElement"],
    summary="Get hierarchical tree for a collection"
)
async def get_meta_element_tree(
    collection_id: UUID,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get a hierarchical tree of MetaElements for a specific collection.
    
    This endpoint retrieves all MetaElements for a collection and organizes
    them into a proper hierarchical tree based on parent-child relationships.
    
    Args:
        collection_id: UUID of the collection to get elements for
        db: Database session
        
    Returns:
        List of dictionaries representing the root elements with their nested children
    """
    try:
        # Use the CRUD function from crud_meta_element module
        return await crud_meta_element.get_meta_element_tree(db, collection_id)
            
    except DBError as e:
        logger.exception(f"Error retrieving meta element tree: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve meta element tree: {str(e)}"
        )


@meta_element_route.get(
    "/subtree/{element_id}",
    response_model=Dict[str, Any],
    tags=["MetaElement"],
    summary="Get subtree starting from a specific element"
)
async def get_meta_element_subtree(
    element_id: UUID,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get a subtree of MetaElements starting from a specific element.
    
    This endpoint retrieves a subtree of MetaElements starting from the specified
    element and including all its descendants in a hierarchical structure.
    
    Args:
        element_id: UUID of the root element to start from
        db: Database session
        
    Returns:
        Dictionary representing the root element with its nested children
    """
    try:
        # Use the CRUD function from crud_meta_element module
        return await crud_meta_element.get_meta_element_subtree(db, element_id)
            
    except DBError as e:
        if "not found" in str(e):
            # If the element doesn't exist, return a 404
            raise HTTPException(
                status_code=404,
                detail=f"Element with ID {element_id} not found"
            )
        
        logger.exception(f"Error retrieving meta element subtree: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve meta element subtree: {str(e)}"
        )

# If needed, add custom routes below:
# @meta_element_route.get("/custom/{param}", ...) 