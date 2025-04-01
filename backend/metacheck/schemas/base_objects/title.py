from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class TitleNew(BaseModel):
    """Schema for creating a new title."""

    id: UUID
    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    collection_id: Optional[UUID] = None


class Title(TitleNew, BaseEntity):
    """Schema for a title."""

    title: Optional["Detection"] = None
    sub_title: Optional["Detection"] = None
    collection: Optional["Collection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class TitleUpdate(BaseModel):
    """Schema for updating a title."""

    id: UUID
    title_id: Optional[str] = None
    sub_title_id: Optional[str] = None
    collection_id: Optional[UUID] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.collection import Collection
