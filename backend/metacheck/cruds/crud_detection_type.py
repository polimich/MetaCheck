import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

async def create_detection_type(
    db: AsyncSession, detection_type_new: base_objects.DetectionTypeNew
):
    """Create a new detection type"""
    try:
        detection_type = detection_type_new.model_dump()
        await crud_general.new(db, detection_type, model.DetectionType)
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed creating detection type in database")
        raise DBError(f"Failed creating detection type in database") from e

async def get_all_detection_types(db: AsyncSession) -> List[base_objects.DetectionType]:
    """Get all detection types"""
    try:
        return await crud_general.get_all(db, base_objects.DetectionType, model.DetectionType)
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching detection types from database")
        raise DBError(f"Failed fetching detection types from database") from e

async def get_detection_type_by_name(db: AsyncSession, name: str) -> Optional[base_objects.DetectionType]:
    """Get a detection type by name"""
    try:
        detections = await get_all_detection_types(db)
        for detection in detections:
            if detection.name == name:
                return detection
        return None
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching detection type by name from database")
        raise DBError(f"Failed fetching detection type by name from database") from e 