from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class MetaElementDetectionNew(BaseModel):
    """Schema for creating a new meta element detection."""

    id: UUID
    meta_element_id: UUID
    meta_role_id: UUID
    detection_id: UUID


class MetaElementDetection(MetaElementDetectionNew, BaseEntity):
    """Schema for a meta element detection."""

    meta_element: Optional["MetaElement"] = None
    meta_role: Optional["MetaRole"] = None
    detection: Optional["Detection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class MetaElementDetectionUpdate(BaseModel):
    """Schema for updating a meta element detection."""

    id: UUID
    meta_element_id: Optional[UUID] = None
    meta_role_id: Optional[UUID] = None
    detection_id: Optional[UUID] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.meta_element import MetaElement
from metacheck.schemas.base_objects.meta_role import MetaRole
from metacheck.schemas.base_objects.detection import Detection 