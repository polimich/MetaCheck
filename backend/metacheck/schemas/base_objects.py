import enum
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class WorkState(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    FINAL = "final"


class ProcessingState(str, enum.Enum):
    PRISTINE = "pristine"
    QUEUED = "queued"
    PROCESSING = "processing"
    ERROR = "error"
    DONE = "done"
    CANCELLED = "cancelled"


class BaseEntity(BaseModel):
    id: UUID

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool


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


# Title
#################################################################
class TitleNew(BaseModel):
    id: UUID
    title: Optional[str] = str()
    sub_title: Optional[str] = str()
    collection_id: Optional[UUID] = None


class Title(TitleNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class TitleUpdate(BaseModel):
    id: UUID
    title: Optional[str] = None
    sub_title: Optional[str] = None
    collection_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Volume
#################################################################
class VolumeNew(BaseModel):
    id: UUID
    collection_id: UUID
    parent_id: Optional[UUID] = None
    part_number: Optional[str] = str()
    part_name: Optional[str] = str()
    date_issued: Optional[str] = str()

    title: Optional[str] = str()
    sub_title: Optional[str] = str()
    edition: Optional[str] = str()
    place_term: Optional[str] = str()
    publisher: Optional[str] = str()
    manufacture_publisher: Optional[str] = str()
    manufacture_place_term: Optional[str] = str()
    author: Optional[str] = str()
    illustrator: Optional[str] = str()
    translator: Optional[str] = str()
    editor: Optional[str] = str()
    series_name: Optional[str] = str()
    series_number: Optional[str] = str()


class Volume(VolumeNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class VolumeUpdate(BaseModel):
    id: UUID
    collection_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    part_number: Optional[str] = None
    part_name: Optional[str] = None
    date_issued: Optional[str] = None

    title: Optional[str] = None
    sub_title: Optional[str] = None
    edition: Optional[str] = None
    place_term: Optional[str] = None
    publisher: Optional[str] = None
    manufacture_publisher: Optional[str] = None
    manufacture_place_term: Optional[str] = None
    author: Optional[str] = None
    illustrator: Optional[str] = None
    translator: Optional[str] = None
    editor: Optional[str] = None
    series_name: Optional[str] = None
    series_number: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Issue
#################################################################
class IssueNew(BaseModel):
    id: UUID
    collection_id: UUID
    parent_id: UUID

    part_number: Optional[str] = str()
    date_issued: Optional[str] = str()

    title: Optional[str] = str()
    sub_title: Optional[str] = str()
    place_term: Optional[str] = str()
    publisher: Optional[str] = str()
    manufacture: Optional[str] = str()
    redaktor: Optional[str] = str()


class Issue(IssueNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class IssueUpdate(BaseModel):
    id: UUID
    collection_id: Optional[UUID] = None

    parent_id: Optional[UUID] = None
    part_number: Optional[str] = None
    date_issued: Optional[str] = None

    title: Optional[str] = None
    sub_title: Optional[str] = None
    place_term: Optional[str] = None
    publisher: Optional[str] = None
    manufacture: Optional[str] = None
    redaktor: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Page
#################################################################
class PageNew(BaseModel):
    id: UUID
    image_id: UUID
    batch_id: UUID
    parent_id: UUID

    page_index: Optional[int] = None
    page_number: Optional[str] = str()
    page_type: Optional[str] = str()


class Page(PageNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class PageUpdate(BaseModel):
    id: UUID
    image_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None

    page_index: Optional[int] = None
    page_number: Optional[str] = None
    page_type: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Chapter
#################################################################
class ChapterNew(BaseModel):
    id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title: Optional[str] = str()
    sub_title: Optional[str] = str()
    part_number: Optional[str] = str()


class Chapter(ChapterNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class ChapterUpdate(BaseModel):
    id: UUID
    parent_id: Optional[UUID] = None

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title: Optional[str] = None
    sub_title: Optional[str] = None
    part_number: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Article
#################################################################
class ArticleNew(BaseModel):
    id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title: Optional[str] = str()
    author: Optional[str] = str()
    abstract: Optional[str] = str()
    keywords: Optional[str] = str()


class Article(ArticleNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class ArticleUpdate(BaseModel):
    id: UUID
    parent_id: Optional[UUID] = None

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title: Optional[str] = None
    author: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
