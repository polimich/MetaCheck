from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.enums import WorkState

if TYPE_CHECKING:
    from metacheck.schemas.base_objects.image import Image
    from metacheck.schemas.base_objects.meta_element import MetaElement


class CollectionNew(BaseModel):
    """Schema for creating a new collection."""

    id: UUID
    name: str
    description: Optional[str] = ""
    info: Optional[str] = ""


class Collection(CollectionNew, BaseEntity):
    """Schema for a collection."""

    confidence: Optional[float] = None
    work_state: WorkState
    image_count: int
    detection_count: int
    annotated_detection_count: int
    preview_image_id: Optional[UUID] = None
    preview_image_height: int
    preview_image_width: int

    class Config:
        from_attributes = True


class CollectionWithMetadata(Collection):
    """Schema for a collection with related entities."""

    images: List["Image"] = []
    # Meta elements by type
    meta_elements: List["MetaElement"] = []

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class CollectionUpdate(BaseModel):
    """Schema for updating a collection."""

    id: UUID
    preview_image_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    info: Optional[str] = None
    work_state: Optional[WorkState] = None
    last_access: Optional[datetime] = None
    is_public: Optional[bool] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.image import Image
from metacheck.schemas.base_objects.meta_element import MetaElement
