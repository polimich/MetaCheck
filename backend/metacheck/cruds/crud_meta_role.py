from sqlalchemy import UUID, select
from sqlalchemy.ext.asyncio import AsyncSession
from db.model.detection import Detection
from db.model.image import Image
from db.model.meta_role import MetaRole
from metacheck.cruds import crud_meta_element
from db.model.meta_element_type import MetaElementType
from db.model.meta_element_detection_attribute_type import MetaElementDetectionAttributeType
from typing import Optional


async def get_available_for_detection(detection_id: UUID, session: AsyncSession):
    # First get the detection and its associated image
    detection = await session.get(Detection, detection_id)
    if not detection:
        # If detection doesn't exist, return all meta roles
        stmt = select(MetaRole)
        result = await session.execute(stmt)
        return result.scalars().all()
    # Get the image and its page meta element
    image = await session.get(Image, detection.image_id)
    if not image:
        return []
        
    # Get all parent elements up to the root
    parent_elements = await crud_meta_element.get_parent_elements_up_to_root_from_detection(
        session,
        detection_id
    )
    if not parent_elements:
        return []
            
    # Get available meta roles for each parent element
    available_meta_roles = []
    for parent_element in parent_elements:
        # Query meta roles that match the parent element's meta_element_type_id
        stmt = select(MetaRole).where(MetaRole.meta_element_type_id == parent_element.meta_element_type_id)
        result = await session.execute(stmt)
        roles = result.scalars().all()
        available_meta_roles.extend(roles)
            
    return available_meta_roles
    
    
async def get_available_for_collection(collection_id: UUID, session: AsyncSession):
    """
    Get all available meta roles for all meta elements in the collection.
    
    Args:
        collection_id: UUID of the collection
        session: AsyncSession for database operations
        
    Returns:
        List of available MetaRole objects for all meta elements in the collection
    """
    # Get all meta elements in the collection
    from db.model.meta_element import MetaElement
    stmt = select(MetaElement).where(
        MetaElement.collection_id == collection_id,
        MetaElement.deleted == False
    )
    result = await session.execute(stmt)
    meta_elements = result.scalars().unique().all()
    
    if not meta_elements:
        return []
    
    # Get all available meta roles for each meta element type
    available_meta_roles = []
    processed_type_ids = set()  # To avoid duplicates
    
    for meta_element in meta_elements:
        # Skip if we've already processed this type
        if meta_element.meta_element_type_id in processed_type_ids:
            continue
            
        # Query meta roles that match this meta element type
        stmt = select(MetaRole).where(
            MetaRole.meta_element_type_id == meta_element.meta_element_type_id,
            MetaRole.deleted == False
        )
        result = await session.execute(stmt)
        roles = result.scalars().unique().all()
        
        available_meta_roles.extend(roles)
        processed_type_ids.add(meta_element.meta_element_type_id)
    
    return sorted(available_meta_roles, key=lambda x: x.computed_name)
    
    
async def find_meta_role(meta_attribute_name: str, meta_element_name: str, session: AsyncSession) -> Optional[UUID]:
    """
    Find a meta role by meta attribute name and meta element name.
    
    Args:
        meta_attribute_name: Name of the meta element detection attribute type
        meta_element_name: Name of the meta element type
        session: AsyncSession for database operations
        
    Returns:
        UUID of the matching meta role or None if not found
    """
    # First find the meta element type by name
    element_type_stmt = select(MetaElementType).where(
        MetaElementType.name == meta_element_name,
        MetaElementType.deleted == False
    )
    element_type_result = await session.execute(element_type_stmt)
    element_type = element_type_result.scalar_one_or_none()
    
    if not element_type:
        return None
        
    # Then find the meta element detection attribute type by name
    attribute_type_stmt = select(MetaElementDetectionAttributeType).where(
        MetaElementDetectionAttributeType.name == meta_attribute_name,
        MetaElementDetectionAttributeType.deleted == False
    )
    attribute_type_result = await session.execute(attribute_type_stmt)
    attribute_type = attribute_type_result.scalar_one_or_none()
    
    if not attribute_type:
        return None
        
    # Finally find the meta role that matches both
    role_stmt = select(MetaRole).where(
        MetaRole.meta_element_type_id == element_type.id,
        MetaRole.meta_element_detection_attribute_type_id == attribute_type.id,
        MetaRole.deleted == False
    )
    role_result = await session.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    
    return role.id if role else None
    
    
