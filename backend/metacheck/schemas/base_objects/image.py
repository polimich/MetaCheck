from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.detection import Detection
from metacheck.schemas.base_objects.enums import WorkState
from metacheck.schemas.base_objects.meta_element import MetaElement

class Image(BaseEntity):
    """Schema for an image."""

    collection_id: UUID
    name: str
    height: int
    width: int
    confidence: Optional[float] = None
    imagehash: Optional[str] = None
    work_state: WorkState
    detections: List[Detection] = []
    detection_count: int
    annotated_detection_count: int
    page_meta_element: Optional["MetaElement"] = None
    class Config:
        from_attributes = True


class ImageUpdate(BaseModel):
    """Schema for updating an image."""

    id: UUID
    name: Optional[str] = None
    work_state: Optional[WorkState] = None
    last_change: Optional[datetime] = None
    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
