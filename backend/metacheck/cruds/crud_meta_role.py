from sqlalchemy import UUID, select
from sqlalchemy.ext.asyncio import AsyncSession
from db.model.detection import Detection
from db.model.image import Image
from db.model.meta_role import MetaRole
from metacheck.cruds import crud_meta_element


async def get_available_for_detection(detection_id: UUID, session: AsyncSession):
    # First get the detection and its associated image
    detection = await session.get(Detection, detection_id)
    if not detection:
        return []
        
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
    