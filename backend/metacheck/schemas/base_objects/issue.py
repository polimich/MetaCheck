from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class IssueNew(BaseModel):
    """Schema for creating a new issue."""

    id: UUID
    collection_id: UUID
    parent_id: UUID

    part_number_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None

    publishers: List["Detection"] = []
    manufactures: List["Detection"] = []
    redaktors: List["Detection"] = []


class Issue(IssueNew, BaseEntity):
    """Schema for an issue."""

    part_number: Optional["Detection"] = None
    date_issued: Optional["Detection"] = None

    title: Optional["Detection"] = None
    sub_title: Optional["Detection"] = None
    place_term: Optional["Detection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class IssueUpdate(BaseModel):
    """Schema for updating an issue."""

    id: UUID
    collection_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None

    part_number_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None

    publishers: Optional[List["Detection"]] = None
    manufactures: Optional[List["Detection"]] = None
    redaktors: Optional[List["Detection"]] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.collection import Collection
