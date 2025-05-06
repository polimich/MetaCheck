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
    root_meta_element_id: Optional[UUID] = None


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
    meta_elements: List["MetaElement"] = []
    images: List["Image"] = []
    root_meta_element_id: Optional[UUID] = None

    class Config:
        from_attributes = True


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
    root_meta_element_id: Optional[UUID] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.image import Image
from metacheck.schemas.base_objects.meta_element import MetaElement
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.meta_element_detection import MetaElementDetection
from metacheck.schemas.base_objects.meta_element_type import MetaElementType

class DetectionHierarchical(Detection, BaseEntity):
    """Schema for a detection with hierarchical structure."""

    meta_element_detections: "MetaElementDetection"

class ImageHierarchical(Image, BaseEntity):
    """Schema for an image with hierarchical structure including detections."""
    
    detections: List["DetectionHierarchical"] = []

class MetaElementHierarchical(MetaElement, BaseEntity):
    """Schema for a meta element with hierarchical structure."""

    children: List["MetaElementHierarchical"] = []
    images: List["ImageHierarchical"] = []
    meta_detections: List["DetectionHierarchical"] = []

class CollectionHierarchical(CollectionNew, BaseEntity):
    """Schema for a collection with hierarchical structure."""

    global_structure: Optional[MetaElementHierarchical] = None
    root_meta_element_id: Optional[UUID] = None
