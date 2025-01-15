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


class PageType(enum.Enum):
    ABSTRACT = "Abstract"
    ADVERTISEMENT = "Advertisement"
    APPENDIX = "Appendix"
    BACK_COVER = "BackCover"
    BACK_END_PAPER = "BackEndPaper"
    BACK_END_SHEET = "BackEndSheet"
    BIBLIOGRAPHY = "Bibliography"
    BLANK = "Blank"
    CALIBRATION_TABLE = "CalibrationTable"
    COVER = "Cover"
    CUSTOM_INCLUDE = "CustomInclude"
    DEDICATION = "Dedication"
    EDGE = "Edge"
    ERRATA = "Errata"
    FLY_LEAF = "FlyLeaf"
    FRAGMENTS_OF_BOOKBINDING = "FragmentsOfBookbinding"
    FRONT_COVER = "FrontCover"
    FRONT_END_PAPER = "FrontEndPaper"
    FRONT_END_SHEET = "FrontEndSheet"
    FRONT_JACKET = "FrontJacket"
    FRONTISPIECE = "Frontispiece"
    ILLUSTRATION = "Illustration"
    IMPRESSUM = "Impressum"
    IMPRIMATUR = "Imprimatur"
    INDEX = "Index"
    JACKET = "Jacket"
    LIST_OF_ILLUSTRATIONS = "ListOfIllustrations"
    LIST_OF_MAPS = "ListOfMaps"
    LIST_OF_TABLES = "ListOfTables"
    MAP = "Map"
    NORMAL_PAGE = "NormalPage"
    OBITUARY = "Obituary"
    PREFACE = "Preface"
    SHEET_MUSIC = "SheetMusic"
    SPINE = "Spine"
    TABLE = "Table"
    TABLE_OF_CONTENTS = "TableOfContents"
    TITLE_PAGE = "TitlePage"


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


# MetaDetection
#################################################################


class MetaDetectionNew(BaseModel):
    id: UUID
    confidence: Optional[float] = None
    value: str


class MetaDetection(MetaDetectionNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool = False

    class Config:
        from_attributes = True


class MetaDetectionUpdate(BaseModel):
    id: UUID
    confidence: Optional[float] = None
    value: Optional[str] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# PageTypeDetection
#################################################################
class PageTypeDetectionNew(BaseModel):
    id: UUID
    confidence: Optional[float] = None
    value: PageType


class PageTypeDetection(PageTypeDetectionNew):

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool = False

    class Config:
        from_attributes = True


class PageTypeDetectionUpdate(BaseModel):
    id: UUID
    confidence: Optional[float] = None
    value: Optional[PageType] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Title
#################################################################
class TitleNew(BaseModel):
    id: UUID
    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    collection_id: Optional[UUID] = None


class Title(TitleNew):

    title: Optional[MetaDetection] = None
    sub_title: Optional[MetaDetection] = None
    collection: Optional[Collection] = None
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class TitleUpdate(BaseModel):
    id: UUID
    title_id: Optional[str] = None
    sub_title_id: Optional[str] = None
    collection_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Volume
#################################################################
class VolumeNew(BaseModel):
    id: UUID
    collection_id: UUID
    parent_id: Optional[UUID] = None

    part_number_id: Optional[UUID] = None
    part_name_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    edition_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    publisher_id: Optional[UUID] = None
    manufacture_publisher_id: Optional[UUID] = None
    manufacture_place_term_id: Optional[UUID] = None
    author_id: Optional[UUID] = None
    illustrator_id: Optional[UUID] = None
    translator_id: Optional[UUID] = None
    editor_id: Optional[UUID] = None
    series_name_id: Optional[UUID] = None
    series_number_id: Optional[UUID] = None


class Volume(VolumeNew):

    part_number: Optional[MetaDetection] = None
    part_name: Optional[MetaDetection] = None
    date_issued: Optional[MetaDetection] = None

    title: Optional[MetaDetection] = None
    sub_title: Optional[MetaDetection] = None
    edition: Optional[MetaDetection] = None
    place_term: Optional[MetaDetection] = None
    publisher: Optional[MetaDetection] = None
    manufacture_publisher: Optional[MetaDetection] = None
    manufacture_place_term: Optional[MetaDetection] = None
    author: Optional[MetaDetection] = None
    illustrator: Optional[MetaDetection] = None
    translator: Optional[MetaDetection] = None
    editor: Optional[MetaDetection] = None
    series_name: Optional[MetaDetection] = None
    series_number: Optional[MetaDetection] = None

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

    part_number_id: Optional[UUID] = None
    part_name_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    edition_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    publisher_id: Optional[UUID] = None
    manufacture_publisher_id: Optional[UUID] = None
    manufacture_place_term_id: Optional[UUID] = None
    author_id: Optional[UUID] = None
    illustrator_id: Optional[UUID] = None
    translator_id: Optional[UUID] = None
    editor_id: Optional[UUID] = None
    series_name_id: Optional[UUID] = None
    series_number_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Issue
#################################################################
class IssueNew(BaseModel):
    id: UUID
    collection_id: UUID
    parent_id: UUID

    part_number_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    publisher_id: Optional[UUID] = None
    manufacture_id: Optional[UUID] = None
    redaktor_id: Optional[UUID] = None


class Issue(IssueNew):
    part_number: Optional[MetaDetection] = None
    date_issued: Optional[MetaDetection] = None

    title: Optional[MetaDetection] = None
    sub_title: Optional[MetaDetection] = None
    place_term: Optional[MetaDetection] = None
    publisher: Optional[MetaDetection] = None
    manufacture: Optional[MetaDetection] = None
    redaktor: Optional[MetaDetection] = None

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

    part_number_id: Optional[UUID] = None
    date_issued_id: Optional[UUID] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    place_term_id: Optional[UUID] = None
    publisher_id: Optional[UUID] = None
    manufacture_id: Optional[UUID] = None
    redaktor_id: Optional[UUID] = None

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

    page_number_id: Optional[UUID] = None
    page_type_id: Optional[UUID] = None


class Page(PageNew):
    page_number: Optional[MetaDetection] = None
    page_type: Optional[PageTypeDetection] = None

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

    page_number_id: Optional[UUID] = None
    page_type_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Chapter
#################################################################
class ChapterNew(BaseModel):
    id: UUID
    collection_id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    part_number_id: Optional[UUID] = None


class Chapter(ChapterNew):
    collection: Optional[Collection] = None
    title: Optional[MetaDetection] = None
    sub_title: Optional[MetaDetection] = None
    part_number: Optional[MetaDetection] = None

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: Optional[bool] = False

    class Config:
        from_attributes = True


class ChapterUpdate(BaseModel):
    id: UUID
    parent_id: Optional[UUID] = None
    collection_id: Optional[UUID] = None

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    sub_title_id: Optional[UUID] = None
    part_number_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Article
#################################################################
class ArticleNew(BaseModel):
    id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    author_id: Optional[UUID] = None
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None


class Article(ArticleNew):
    title: Optional[MetaDetection] = None
    author: Optional[MetaDetection] = None
    abstract: Optional[MetaDetection] = None
    keywords: Optional[MetaDetection] = None

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

    title_id: Optional[UUID] = None
    author_id: Optional[UUID] = None
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
