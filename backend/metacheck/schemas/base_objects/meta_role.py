# Author: Michael Polívka xpoliv07
# Summary: Meta role schemas for managing the roles of detections within meta elements.

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class MetaRoleNew(BaseModel):
    """Schema for creating a new meta role."""

    id: UUID
    meta_element_type_id: UUID
    meta_element_detection_attribute_type_id: UUID
    color: str


class MetaRole(MetaRoleNew, BaseEntity):
    """Schema for a meta role."""

    meta_element_type: Optional["MetaElementType"] = None
    meta_element_detection_attribute_type: Optional["MetaElementDetectionAttributeType"] = None
    computed_name: Optional[str] = None
    computed_display_name: Optional[str] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class MetaRoleUpdate(BaseModel):
    """Schema for updating a meta role."""

    id: UUID
    meta_element_type_id: Optional[UUID] = None
    meta_element_detection_attribute_type_id: Optional[UUID] = None
    color: Optional[str] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.meta_element_type import MetaElementType
from metacheck.schemas.base_objects.meta_element_detection_attribute_type import MetaElementDetectionAttributeType
