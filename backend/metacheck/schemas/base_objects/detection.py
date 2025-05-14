# Author: Michael Polívka xpoliv07
# Summary: Detection schemas including new and update models for managing text regions and annotations.

from __future__ import annotations

from typing import Optional, TYPE_CHECKING, ForwardRef
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity

# Break circular import using TYPE_CHECKING
if TYPE_CHECKING:
    from metacheck.schemas.base_objects.image import Image
else:
    # Use ForwardRef for forward references
    Image = ForwardRef('Image')


class DetectionNew(BaseModel):
    """Schema for creating a new detection."""

    id: UUID
    image_id: UUID
    bbox: str
    value: str = ""
    confidence: Optional[float] = None


class Detection(DetectionNew, BaseEntity):
    """Schema for a detection."""

    annotated: bool = False
    computed_color: Optional[str] = None
    computed_type: Optional[str] = None
    computed_display_type: Optional[str] = None
    
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
