from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, List, Any
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class MetaElementNew(BaseModel):
    """Schema for creating a new meta element."""

    id: UUID
    collection_id: UUID
    meta_element_type_id: UUID
    parent_id: Optional[UUID] = None
    attributes: Optional[Dict[str, Any]] = None


class MetaElement(MetaElementNew, BaseEntity):
    """Schema for a meta element."""

    collection: Optional["Collection"] = None
    meta_element_type: Optional["MetaElementType"] = None
    parent: Optional["MetaElement"] = None
    children: Optional[List["MetaElement"]] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class MetaElementUpdate(BaseModel):
    """Schema for updating a meta element."""

    id: UUID
    collection_id: Optional[UUID] = None
    meta_element_type_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    attributes: Optional[Dict[str, Any]] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.collection import Collection
from metacheck.schemas.base_objects.meta_element_type import MetaElementType 