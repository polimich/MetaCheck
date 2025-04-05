from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.detection_type import DetectionType


class DetectionNew(BaseModel):
    """Schema for creating a new detection."""

    id: UUID
    type_id: UUID
    image_id: UUID
    bbox: str
    value: str = ""
    confidence: Optional[float] = None


class Detection(DetectionNew, BaseEntity):
    """Schema for a detection."""

    annotated: bool = False

    class Config:
        from_attributes = True


class DetectionUpdate(BaseModel):
    """Schema for updating a detection."""

    id: UUID
    value: Optional[str] = None
    image_id: Optional[UUID] = None
    annotated: Optional[bool] = None
    confidence: Optional[float] = None
    bbox: Optional[str] = None
    deleted: Optional[bool] = None
