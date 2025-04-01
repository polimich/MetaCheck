from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class DetectionTypeNew(BaseModel):
    """Schema for creating a new detection type."""

    id: UUID
    name: str
    color: str
    display_name: str


class DetectionType(DetectionTypeNew, BaseEntity):
    """Schema for a detection type."""

    class Config:
        from_attributes = True


class DetectionTypeUpdate(BaseModel):
    """Schema for updating a detection type."""

    id: UUID
    name: Optional[str] = None
    color: Optional[str] = None
    display_name: Optional[str] = None
    deleted: Optional[bool] = None
