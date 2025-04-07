"""
Base Pydantic models for the MetaCheck application.
"""

from pydantic import BaseModel

from metacheck.constants import META_ELEMENT_TYPE_IDS
from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.collection import (
    Collection,
    CollectionNew,
    CollectionUpdate,
)
from metacheck.schemas.base_objects.detection import (
    Detection,
    DetectionNew,
    DetectionUpdate,
)
from metacheck.schemas.base_objects.enums import WorkState, ProcessingState, PageType
from metacheck.schemas.base_objects.image import Image, ImageUpdate
from metacheck.schemas.base_objects.meta_element import MetaElement, MetaElementNew, MetaElementUpdate
from metacheck.schemas.base_objects.meta_element_detection import MetaElementDetection, MetaElementDetectionNew, MetaElementDetectionUpdate
from metacheck.schemas.base_objects.meta_element_detection_attribute_type import MetaElementDetectionAttributeType, MetaElementDetectionAttributeTypeNew, MetaElementDetectionAttributeTypeUpdate
from metacheck.schemas.base_objects.meta_element_type import MetaElementType, MetaElementTypeNew, MetaElementTypeUpdate
from metacheck.schemas.base_objects.meta_role import MetaRole, MetaRoleNew, MetaRoleUpdate
__all__ = [
    BaseModel,
    "WorkState",
    "ProcessingState",
    "PageType",
    "BaseEntity",
    "Detection",
    "DetectionNew",
    "DetectionUpdate",
    "Image",
    "ImageUpdate",
    "Collection",
    "CollectionNew",
    "CollectionUpdate",
    "MetaElement",
    "MetaElementNew",
    "MetaElementUpdate",
    "MetaElementDetection",
    "MetaElementDetectionNew",
    "MetaElementDetectionUpdate",
    "MetaElementDetectionAttributeType",
    "MetaElementDetectionAttributeTypeNew",
    "MetaElementDetectionAttributeTypeUpdate",
    "MetaElementType",
    "MetaElementTypeNew",
    "MetaElementTypeUpdate",
    "MetaRole",
    "MetaRoleNew",
    "MetaRoleUpdate",
    "META_ELEMENT_TYPE_IDS",
]
