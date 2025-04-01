"""
Base Pydantic models for the MetaCheck application.
"""

from pydantic import BaseModel

from metacheck.schemas.base_objects.article import Article, ArticleNew, ArticleUpdate
from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.chapter import Chapter, ChapterNew, ChapterUpdate
from metacheck.schemas.base_objects.collection import (
    Collection,
    CollectionNew,
    CollectionUpdate,
    CollectionWithMetadata,
)
from metacheck.schemas.base_objects.detection import (
    Detection,
    DetectionNew,
    DetectionUpdate,
)
from metacheck.schemas.base_objects.detection_type import (
    DetectionType,
    DetectionTypeNew,
    DetectionTypeUpdate,
)
from metacheck.schemas.base_objects.enums import WorkState, ProcessingState, PageType
from metacheck.schemas.base_objects.image import Image, ImageUpdate
from metacheck.schemas.base_objects.issue import Issue, IssueNew, IssueUpdate
from metacheck.schemas.base_objects.page import Page, PageNew, PageUpdate
from metacheck.schemas.base_objects.page_type_detection import (
    PageTypeDetection,
    PageTypeDetectionNew,
    PageTypeDetectionUpdate,
)
from metacheck.schemas.base_objects.title import Title, TitleNew, TitleUpdate
from metacheck.schemas.base_objects.volume import Volume, VolumeNew, VolumeUpdate

__all__ = [
    BaseModel,
    "WorkState",
    "ProcessingState",
    "PageType",
    "BaseEntity",
    "DetectionType",
    "DetectionTypeNew",
    "DetectionTypeUpdate",
    "Detection",
    "DetectionNew",
    "DetectionUpdate",
    "Image",
    "ImageUpdate",
    "Collection",
    "CollectionNew",
    "CollectionUpdate",
    "CollectionWithMetadata",
    "PageTypeDetection",
    "PageTypeDetectionNew",
    "PageTypeDetectionUpdate",
    "Title",
    "TitleNew",
    "TitleUpdate",
    "Volume",
    "VolumeNew",
    "VolumeUpdate",
    "Issue",
    "IssueNew",
    "IssueUpdate",
    "Page",
    "PageNew",
    "PageUpdate",
    "Chapter",
    "ChapterNew",
    "ChapterUpdate",
    "Article",
    "ArticleNew",
    "ArticleUpdate",
]
