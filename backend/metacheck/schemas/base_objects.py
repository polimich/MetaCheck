import enum

from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class WorkState(str, enum.Enum):
    NEW = 'new'
    IN_PROGRESS = 'in_progress'
    DONE = 'done'
    FINAL = 'final'


class ProcessingState(str, enum.Enum):
    PRISTINE = 'pristine'
    QUEUED = 'queued'
    PROCESSING = 'processing'
    ERROR = 'error'
    DONE = 'done'
    CANCELLED = 'cancelled'


# DETECTION
#################################################################
class DetectionNew(BaseModel):
    id: UUID

    type: str
    bbox: str

    confidence: Optional[float] = None


class Detection(DetectionNew):
    image_id: UUID

    annotated: bool = False

    deleted: bool

    class Config:
        from_attributes = True


class DetectionUpdate(BaseModel):
    id: UUID
    image_id: Optional[UUID] = None

    type: Optional[str] = None
    bbox: Optional[str] = None

    deleted: Optional[bool] = None
#################################################################


# IMAGE
#################################################################
class Image(BaseModel):
    id: UUID

    collection_id: UUID

    name: str
    order: int
    height: int
    width: int

    confidence: Optional[float] = None

    imagehash: Optional[str] = None

    work_state: WorkState

    detection_count: int
    annotated_detection_count: int

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool

    class Config:
        from_attributes = True


class ImageUpdate(BaseModel):
    id: UUID

    name: Optional[str] = None
    order: Optional[int] = None

    work_state: Optional[WorkState] = None

    last_change: Optional[datetime] = None
    last_access: Optional[datetime] = None

    deleted: Optional[bool] = None
#################################################################


# COLLECTION
#################################################################
class CollectionNew(BaseModel):
    id: UUID

    name: str
    description: Optional[str] = str()
    info: Optional[str] = str()


class Collection(CollectionNew):
    confidence: Optional[float] = None

    work_state: WorkState

    image_count: int
    detection_count: int
    annotated_detection_count: int

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    preview_image_id: Optional[UUID] = None
    preview_image_height: int
    preview_image_width: int

    class Config:
        from_attributes = True


class CollectionUpdate(BaseModel):
    id: UUID
    preview_image_id: Optional[UUID] = None

    name: Optional[str] = None
    description: Optional[str] = None
    info: Optional[str] = None

    work_state: Optional[WorkState] = None

    last_access: Optional[datetime] = None

    is_public: Optional[bool] = None
    deleted: Optional[bool] = None
#################################################################