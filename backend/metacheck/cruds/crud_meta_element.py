import logging
from typing import Dict, List, Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import DBError
from metacheck.schemas.base_objects import MetaElementNew

logger = logging.getLogger(__name__)


def build_element_tree(elements: List[model.MetaElement]) -> List[Dict[str, Any]]:
    """
    Build a hierarchical tree from a flat list of MetaElements.
    
    Args:
        elements: List of MetaElement SQLAlchemy objects
        
    Returns:
        List of dictionaries representing the root elements with their children
    """
    # Convert all elements to dictionaries using our safe conversion function
    element_dicts = [crud_general.sqlalchemy_to_dict(element) for element in elements]
    
    # Create a mapping of element ID to its dictionary
    element_map = {element['id']: element for element in element_dicts}
    
    # Create a mapping of parent ID to list of children
    parent_to_children = {}
    root_elements = []
    
    # First pass: group elements by parent
    for element in element_dicts:
        # Add to roots if no parent
        if element.get('parent_id') is None:
            root_elements.append(element)
        else:
            # Add to parent's children list
            parent_id = element['parent_id']
            if parent_id not in parent_to_children:
                parent_to_children[parent_id] = []
            parent_to_children[parent_id].append(element)
    
    # Second pass: build the tree by setting children on each element
    for element_id, children in parent_to_children.items():
        if element_id in element_map:
            element_map[element_id]['children'] = children
    
    return root_elements


async def create_meta_element(db: AsyncSession, meta_element: MetaElementNew) -> model.MetaElement:
    """
    Create a new meta element in the database.
    
    Args:
        db: Database session
        meta_element: Schema with meta element data
        
    Returns:
        Created meta element SQLAlchemy object
        
    Raises:
        DBError: If there's an error creating the meta element
    """
    try:
        # Create the element directly - simpler approach to avoid refresh issues
        db_obj = model.MetaElement(**meta_element.model_dump())
        db.add(db_obj)
        return db_obj
            
    except Exception as e:
        logger.exception(f"Error creating meta element: {str(e)}")
        raise DBError(f"Failed to create meta element: {str(e)}")


async def get_meta_element_tree(
    db: AsyncSession, 
    collection_id: UUID
) -> List[Dict[str, Any]]:
    """
    Get a hierarchical tree of MetaElements for a specific collection.
    
    Args:
        db: Database session
        collection_id: UUID of the collection to get elements for
        
    Returns:
        List of dictionaries representing the root elements with their nested children
        
    Raises:
        DBError: If there's an error retrieving the meta elements
    """
    try:
        async with db.begin():
            # Query all meta elements for this collection
            query = (
                select(model.MetaElement)
                .where(model.MetaElement.collection_id == collection_id)
                .where(model.MetaElement.deleted == False)
            )
            
            # Execute the query
            result = await db.execute(query)
            elements = result.unique().scalars().all()
            
            if not elements:
                return []
            
            # Build the hierarchical tree
            tree = build_element_tree(elements)
            
            return tree
            
    except Exception as e:
        logger.exception(f"Error retrieving meta element tree: {str(e)}")
        raise DBError(f"Failed to retrieve meta element tree: {str(e)}")


async def get_meta_element_subtree(
    db: AsyncSession, 
    root_element_id: UUID
) -> Dict[str, Any]:
    """
    Get a subtree of MetaElements starting from a specific root element.
    
    Args:
        db: Database session
        root_element_id: UUID of the root element to start from
        
    Returns:
        Dictionary representing the root element with its nested children
        
    Raises:
        DBError: If there's an error retrieving the meta elements or if the root element doesn't exist
    """
    try:
        async with db.begin():
            # First get the root element
            query_root = (
                select(model.MetaElement)
                .where(model.MetaElement.id == root_element_id)
                .where(model.MetaElement.deleted == False)
            )
            
            result_root = await db.execute(query_root)
            root_element = result_root.unique().scalar_one_or_none()
            
            if root_element is None:
                raise DBError(f"Root element with ID {root_element_id} not found")
                
            # Get its collection ID
            collection_id = root_element.collection_id
            
            # Get all elements in the same collection
            query = (
                select(model.MetaElement)
                .where(model.MetaElement.collection_id == collection_id)
                .where(model.MetaElement.deleted == False)
            )
            
            result = await db.execute(query)
            all_elements = result.unique().scalars().all()
            
            # Build the full tree
            full_tree = build_element_tree(all_elements)
            
            # Find the subtree starting from our root element
            # Convert root_element to dict
            root_dict = crud_general.sqlalchemy_to_dict(root_element)
            
            # Function to find an element in the tree by ID
            def find_element_by_id(tree, element_id):
                for element in tree:
                    if element['id'] == element_id:
                        return element
                    if 'children' in element and element['children']:
                        found = find_element_by_id(element['children'], element_id)
                        if found:
                            return found
                return None
            
            # Find our root element in the full tree
            subtree = find_element_by_id(full_tree, root_element_id)
            
            # If not found in the tree (should never happen), return just the root element
            if subtree is None:
                return root_dict
                
            return subtree
            
    except DBError as e:
        # Re-raise DBError as is
        raise e
    except Exception as e:
        logger.exception(f"Error retrieving meta element subtree: {str(e)}")
        raise DBError(f"Failed to retrieve meta element subtree: {str(e)}") 