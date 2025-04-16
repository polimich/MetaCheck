from __future__ import annotations

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING, ForwardRef, Dict, Any
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.enums import WorkState, PageType

# Break circular import using TYPE_CHECKING
if TYPE_CHECKING:
    from metacheck.schemas.base_objects.detection import Detection
    from metacheck.schemas.base_objects.meta_element import MetaElement
    from metacheck.schemas.base_objects.meta_element_type import MetaElementType
else:
    # Use string literals for forward references
    Detection = ForwardRef('Detection')
    MetaElement = ForwardRef('MetaElement')


class Image(BaseEntity):
    """Schema for an image."""

    collection_id: UUID
    parent_meta_element_id: UUID  # Renamed from page_meta_element_id
    name: str
    height: int
    width: int
    confidence: Optional[float] = None
    imagehash: Optional[str] = None
    work_state: WorkState
    detections: List[Detection] = []
    detection_count: int
    annotated_detection_count: int
    parent_meta_element: Optional[MetaElement] = None  # Renamed from page_meta_element
    order: int
    page_index: Optional[str] = None  # Changed from Detection to string
    page_index_confidence: Optional[float] = None  # Add page_index_confidence field
    page_type: Optional[PageType] = None  # Add page_type field
    page_type_confidence: Optional[float] = None  # Add page_type_confidence field
    
    class Config:
        from_attributes = True


class ImageUpdate(BaseModel):
    """Schema for updating an image."""

    id: UUID
    name: Optional[str] = None
    work_state: Optional[WorkState] = None
    page_type: Optional[PageType] = None  # Add page_type field
    page_type_confidence: Optional[float] = None  # Add page_type_confidence field
    page_index: Optional[str] = None  # Changed from UUID to string
    page_index_confidence: Optional[float] = None  # Add page_index_confidence field
    last_change: Optional[datetime] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
