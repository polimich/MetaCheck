from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.enums import PageType


class PageTypeDetectionNew(BaseModel):
    """Schema for creating a new page type detection."""

    id: UUID
    confidence: Optional[float] = None
    value: PageType


class PageTypeDetection(PageTypeDetectionNew, BaseEntity):
    """Schema for a page type detection."""

    class Config:
        from_attributes = True


class PageTypeDetectionUpdate(BaseModel):
    """Schema for updating a page type detection."""

    id: UUID
    confidence: Optional[float] = None
    value: Optional[PageType] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
