from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class ChapterNew(BaseModel):
    """Schema for creating a new chapter."""

    id: UUID
    collection_id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    part_number_id: Optional[UUID] = None


class Chapter(ChapterNew, BaseEntity):
    """Schema for a chapter."""

    collection: Optional["Collection"] = None
    title: Optional["Detection"] = None
    sub_title: Optional["Detection"] = None
    part_number: Optional["Detection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class ChapterUpdate(BaseModel):
    """Schema for updating a chapter."""

    id: UUID
    parent_id: Optional[UUID] = None
    collection_id: Optional[UUID] = None

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    part_number_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.collection import Collection