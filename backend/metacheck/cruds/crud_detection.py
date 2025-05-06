import logging
from typing import Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.model.meta_element_detection import MetaElementDetection
from db.model.meta_role import MetaRole
from db.model.detection import Detection
from metacheck.cruds import crud_meta_element
from metacheck.database import DBError

logger = logging.getLogger(__name__)


async def change_detection_meta_role(
    detection_id: UUID, 
    meta_role_id: UUID, 
    session: AsyncSession
) -> bool:
    """
    Change the meta role for a detection, potentially moving it to a different meta element
    if the new meta role belongs to a different meta element type.
    
    Args:
        detection_id: ID of the detection to update
        meta_role_id: ID of the new meta role to assign
        session: Database session
        
    Returns:
        True if the update was successful, False if the detection or meta role was not found
        
    Raises:
        DBError: If there's an error during the update
    """
    try:
        # Get the current meta element detection and new meta role in a single query
        stmt = (
            select(MetaElementDetection, MetaRole)
            .join(MetaRole, MetaElementDetection.meta_role_id == MetaRole.id)
            .where(MetaElementDetection.detection_id == detection_id)
        )
        result = await session.execute(stmt)
        row = result.unique().first()
        
        if not row:
            logger.warning(f"No meta element detection found for detection {detection_id}")
            return False
            
        meta_element_detection, current_meta_role = row
        
        # Get the new meta role
        stmt = select(MetaRole).where(MetaRole.id == meta_role_id)
        result = await session.execute(stmt)
        new_meta_role = result.unique().scalar_one_or_none()
        
        if not new_meta_role:
            logger.warning(f"No meta role found with ID {meta_role_id}")
            return False
            
        # If meta element types match, just update the meta role
        if current_meta_role.meta_element_type_id == new_meta_role.meta_element_type_id:
            meta_element_detection.meta_role_id = meta_role_id
            meta_element_detection.last_change = datetime.utcnow()
            await session.commit()
            return True
            
        # If meta element types don't match, find a suitable parent element
        parent_elements = await crud_meta_element.get_parent_elements_up_to_root_from_detection(
            session,
            detection_id
        )
        
        if not parent_elements:
            logger.warning(f"No parent elements found for detection {detection_id}")
            return False
            
        # Find the first parent element that matches the new meta role's type
        for element in parent_elements:
            if new_meta_role.meta_element_type_id == element.meta_element_type_id:
                meta_element_detection.meta_role_id = meta_role_id
                meta_element_detection.meta_element_id = element.id
                meta_element_detection.last_change = datetime.utcnow()
                await session.commit()
                return True
                
        logger.warning(
            f"No suitable parent element found for meta role {meta_role_id} "
            f"in the hierarchy of detection {detection_id}"
        )
        return False
        
    except Exception as e:
        logger.exception(f"Error changing meta role for detection {detection_id}: {str(e)}")
        raise DBError(f"Failed to change meta role: {str(e)}")
            
            


async def update_detection_meta_role(
    detection_id: UUID,
    meta_role_id: UUID,
    value: str,
    session: AsyncSession
) -> bool:
    """
    Update the meta role for a detection with a new value.
    
    Args:
        detection_id: ID of the detection to update
        meta_role_id: ID of the meta role to update
        value: New value for the meta role
        session: Database session
        
    Returns:
        True if the update was successful, False if the detection or meta role was not found
        
    Raises:
        DBError: If there's an error during the update
    """
    try:
        # Find the detection and update its value and confidence
        stmt = select(Detection).where(Detection.id == detection_id)
        result = await session.execute(stmt)
        detection = result.unique().scalar_one_or_none()
        
        if not detection:
            logger.warning(f"No detection found with ID {detection_id}")
            return False
            
        # Update detection value and set confidence to 1
        detection.value = value
        detection.confidence = 1.0
        
        # Find the meta_element_detection
        stmt = (
            select(MetaElementDetection, MetaRole)
            .join(MetaRole, MetaElementDetection.meta_role_id == MetaRole.id)
            .where(MetaElementDetection.detection_id == detection_id)
        )
        result = await session.execute(stmt)
        row = result.unique().first()
        
        if not row:
            logger.warning(f"No meta element detection found for detection {detection_id}")
            return False
            
        meta_element_detection, current_meta_role = row
        
        # If meta_role_id is the same, no need to update the meta_role
        if meta_element_detection.meta_role_id == meta_role_id:
            meta_element_detection.last_change = datetime.utcnow()
            await session.commit()
            return True
            
        # Get the new meta role
        stmt = select(MetaRole).where(MetaRole.id == meta_role_id)
        result = await session.execute(stmt)
        new_meta_role = result.unique().scalar_one_or_none()
        
        if not new_meta_role:
            logger.warning(f"No meta role found with ID {meta_role_id}")
            return False
            
        # If meta element types match, just update the meta role
        if current_meta_role.meta_element_type_id == new_meta_role.meta_element_type_id:
            meta_element_detection.meta_role_id = meta_role_id
            meta_element_detection.last_change = datetime.utcnow()
            await session.commit()
            return True
            
        # If meta element types don't match, find a suitable parent element
        parent_elements = await crud_meta_element.get_parent_elements_up_to_root_from_detection(
            session,
            detection_id
        )
        
        if not parent_elements:
            logger.warning(f"No parent elements found for detection {detection_id}")
            return False
            
        # Find the first parent element that matches the new meta role's type
        for element in parent_elements:
            if new_meta_role.meta_element_type_id == element.meta_element_type_id:
                meta_element_detection.meta_role_id = meta_role_id
                meta_element_detection.meta_element_id = element.id
                meta_element_detection.last_change = datetime.utcnow()
                await session.commit()
                return True
                
        logger.warning(
            f"No suitable parent element found for meta role {meta_role_id} "
            f"in the hierarchy of detection {detection_id}"
        )
        return False
        
    except Exception as e:
        logger.exception(f"Error updating detection and meta role for detection {detection_id}: {str(e)}")
        raise DBError(f"Failed to update detection and meta role: {str(e)}")
            
            


async def confirm_detection(
    detection_id: UUID,
    session: AsyncSession
) -> bool:
    """
    Confirm a detection by setting its confidence to 1.0 and annotated to True.
    
    Args:
        detection_id: ID of the detection to confirm
        session: Database session
        
    Returns:
        True if the confirmation was successful, False if the detection was not found
        
    Raises:
        DBError: If there's an error during the confirmation
    """
    try:
        # Find the detection
        stmt = select(Detection).where(Detection.id == detection_id)
        result = await session.execute(stmt)
        detection = result.unique().scalar_one_or_none()
        
        if not detection:
            logger.warning(f"No detection found with ID {detection_id}")
            return False
            
        # Update detection confidence and set annotated to True
        detection.confidence = 1.0
        detection.annotated = True
        detection.last_change = datetime.utcnow()
        
        await session.commit()
        return True
        
    except Exception as e:
        logger.exception(f"Error confirming detection {detection_id}: {str(e)}")
        raise DBError(f"Failed to confirm detection: {str(e)}")


