# Author: Michael Polívka xpoliv07
# Summary: Meta element detection attribute type schemas for managing attribute types in detections.

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class MetaElementDetectionAttributeTypeNew(BaseModel):
    """Schema for creating a new meta element detection attribute type."""

    id: UUID
    name: str
    display_name: Optional[str] = None


class MetaElementDetectionAttributeType(MetaElementDetectionAttributeTypeNew, BaseEntity):
    """Schema for a meta element detection attribute type."""

    class Config:
        from_attributes = True


class MetaElementDetectionAttributeTypeUpdate(BaseModel):
    """Schema for updating a meta element detection attribute type."""

    id: UUID
    name: Optional[str] = None
    display_name: Optional[str] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
