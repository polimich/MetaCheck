from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class VolumeNew(BaseModel):
    """Schema for creating a new volume."""

    id: UUID
    collection_id: UUID
    parent_id: Optional[UUID] = None

    part_number_id: Optional[UUID] = None
    part_name_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    edition_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    series_name_id: Optional[UUID] = None
    series_number_id: Optional[UUID] = None

    publishers: List["Detection"] = []
    manufacture_publishers: List["Detection"] = []
    manufacture_place_terms: List["Detection"] = []
    authors: List["Detection"] = []
    illustrators: List["Detection"] = []
    translators: List["Detection"] = []
    editors: List["Detection"] = []


class Volume(VolumeNew, BaseEntity):
    """Schema for a volume."""

    part_number: Optional["Detection"] = None
    part_name: Optional["Detection"] = None
    date_issued: Optional["Detection"] = None

    title: Optional["Detection"] = None
    sub_title: Optional["Detection"] = None
    edition: Optional["Detection"] = None
    place_term: Optional["Detection"] = None
    series_name: Optional["Detection"] = None
    series_number: Optional["Detection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class VolumeUpdate(BaseModel):
    """Schema for updating a volume."""

    id: UUID
    collection_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None

    part_number_id: Optional[UUID] = None
    part_name_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    edition_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    publishers: Optional[List["Detection"]] = None
    manufacture_publishers: Optional[List["Detection"]] = None
    manufacture_place_terms: Optional[List["Detection"]] = None
    authors: Optional[List["Detection"]] = None
    illustrators: Optional[List["Detection"]] = None
    translators: Optional[List["Detection"]] = None
    editors: Optional[List["Detection"]] = None
    series_name_id: Optional[UUID] = None
    series_number_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.collection import Collection
