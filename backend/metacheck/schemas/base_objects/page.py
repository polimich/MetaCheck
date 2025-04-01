from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class PageNew(BaseModel):
    """Schema for creating a new page."""

    id: UUID
    image_id: UUID
    batch_id: UUID
    parent_id: UUID

    page_index: Optional[int] = None

    page_number_id: Optional[UUID] = None
    page_type_id: Optional[UUID] = None


class Page(PageNew, BaseEntity):
    """Schema for a page."""

    page_number: Optional["Detection"] = None
    page_type: Optional["PageTypeDetection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class PageUpdate(BaseModel):
    """Schema for updating a page."""

    id: UUID
    image_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None

    page_index: Optional[int] = None

    page_number_id: Optional[UUID] = None
    page_type_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.page_type_detection import PageTypeDetection
from metacheck.schemas.base_objects.image import Image
