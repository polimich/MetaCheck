# Author: Michael Polívka xpoliv07
# Summary: Meta element schemas for managing hierarchical document structures such as titles, volumes, and issues.

from __future__ import annotations

from datetime import datetime
import json
from typing import Optional, Dict, List, Any, TYPE_CHECKING, ForwardRef
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator

from metacheck.schemas.base_objects.base_entity import BaseEntity

# Break circular import using TYPE_CHECKING
if TYPE_CHECKING:
    from metacheck.schemas.base_objects.collection import Collection
    from metacheck.schemas.base_objects.meta_element_type import MetaElementType
    from metacheck.schemas.base_objects.image import Image
else:
    # Use ForwardRef for forward references
    Collection = ForwardRef('Collection')
    MetaElementType = ForwardRef('MetaElementType')
    Image = ForwardRef('Image')
    

class MetaElementNew(BaseModel):
    """Schema for creating a new meta element."""

    id: UUID
    collection_id: UUID
    meta_element_type_id: UUID
    parent_id: Optional[UUID] = None
    attributes: Optional[Dict[str, Any]] = None

    @field_validator('attributes')
    @classmethod
    def validate_attributes(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON in attributes field")
        return v


class MetaElement(MetaElementNew, BaseEntity):
    """Schema for a meta element."""

    collection: Optional[Collection] = None
    meta_element_type: Optional[MetaElementType] = None
    parent: Optional["MetaElement"] = None
    children: Optional[List["MetaElement"]] = None
    images: Optional[List[Image]] = []

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

    @field_validator('attributes')
    @classmethod
    def validate_attributes(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON in attributes field")
        return v 