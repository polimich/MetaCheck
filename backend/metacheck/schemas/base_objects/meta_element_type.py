from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class MetaElementTypeNew(BaseModel):
    """Schema for creating a new meta element type."""

    id: UUID
    name: str
    display_name: Optional[str] = None


class MetaElementType(MetaElementTypeNew, BaseEntity):
    """Schema for a meta element type."""

    class Config:
        from_attributes = True


class MetaElementTypeUpdate(BaseModel):
    """Schema for updating a meta element type."""

    id: UUID
    name: Optional[str] = None
    display_name: Optional[str] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
