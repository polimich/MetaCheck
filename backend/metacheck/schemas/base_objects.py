import enum
from datetime import datetime
from typing import Optional, List
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
class DetectionTypeNew(BaseModel):
    id: UUID
    name: str
    color: str
    display_name: str


class DetectionType(DetectionTypeNew):
    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool

    class Config:
        from_attributes = True


class DetectionTypeUpdate(BaseModel):
    id: UUID
    name: Optional[str] = None
    color: Optional[str] = None
    display_color: Optional[str] = None

    deleted: Optional[bool] = None


class DetectionNew(BaseModel):
    id: UUID

    type_id: UUID
    bbox: str

    confidence: Optional[float] = None


class Detection(DetectionNew):
    image_id: UUID
    type: DetectionType
    annotated: bool = False

    created_date: datetime
    last_change: datetime
    last_access: datetime

    deleted: bool

    class Config:
        from_attributes = True


class DetectionUpdate(BaseModel):
    id: UUID
    image_id: Optional[UUID] = None
    annotated: Optional[bool] = None

    type_id: Optional[UUID] = None
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

    detections: List[Detection] = []

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


class CollectionWithMetadata(Collection):
    images: List["Image"] = []
    titles: List["Title"] = []
    volumes: List["Volume"] = []
    issues: List["Issue"] = []
    chapters: List["Chapter"] = []
    articles: List["Article"] = []

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
    title: Optional[Detection] = None
    sub_title: Optional[Detection] = None
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
    series_name_id: Optional[UUID] = None
    series_number_id: Optional[UUID] = None

    publishers: List[Detection] = []
    manufacture_publishers: List[Detection] = []
    manufacture_place_terms: List[Detection] = []
    authors: List[Detection] = []
    illustrators: List[Detection] = []
    translators: List[Detection] = []
    editors: List[Detection] = []


class Volume(VolumeNew):
    part_number: Optional[Detection] = None
    part_name: Optional[Detection] = None
    date_issued: Optional[Detection] = None

    title: Optional[Detection] = None
    sub_title: Optional[Detection] = None
    edition: Optional[Detection] = None
    place_term: Optional[Detection] = None
    series_name: Optional[Detection] = None
    series_number: Optional[Detection] = None

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
    publishers: Optional[List[Detection]] = None
    manufacture_publishers: Optional[List[Detection]] = None
    manufacture_place_terms: Optional[List[Detection]] = None
    authors: Optional[List[Detection]] = None
    illustrators: Optional[List[Detection]] = None
    translators: Optional[List[Detection]] = None
    editors: Optional[List[Detection]] = None
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

    publishers: List[Detection] = []
    manufactures: List[Detection] = []
    redaktors: List[Detection] = []


class Issue(IssueNew):
    part_number: Optional[Detection] = None
    date_issued: Optional[Detection] = None

    title: Optional[Detection] = None
    sub_title: Optional[Detection] = None
    place_term: Optional[Detection] = None

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

    publishers: Optional[List[Detection]] = None
    manufactures: Optional[List[Detection]] = None
    redaktors: Optional[List[Detection]] = None

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
    page_number: Optional[Detection] = None
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
    title: Optional[Detection] = None
    sub_title: Optional[Detection] = None
    part_number: Optional[Detection] = None

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
    authors: List[Detection] = []
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None


class Article(ArticleNew):
    title: Optional[Detection] = None
    abstract: Optional[Detection] = None
    keywords: Optional[Detection] = None

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
    authors: Optional[List[Detection]] = None
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None
