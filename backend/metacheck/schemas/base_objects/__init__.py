"""
Base Pydantic models for the MetaCheck application.

Author: Michael Polívka xpoliv07
"""

from pydantic import BaseModel

from metacheck.constants import META_ELEMENT_TYPE_IDS
from metacheck.schemas.base_objects.base_entity import BaseEntity
from metacheck.schemas.base_objects.enums import WorkState, ProcessingState, PageType

# Import models in dependency order to avoid issues with forward references
from metacheck.schemas.base_objects.meta_element_type import (
    MetaElementType, 
    MetaElementTypeNew, 
    MetaElementTypeUpdate
)

from metacheck.schemas.base_objects.meta_element_detection_attribute_type import (
    MetaElementDetectionAttributeType, 
    MetaElementDetectionAttributeTypeNew, 
    MetaElementDetectionAttributeTypeUpdate
)

from metacheck.schemas.base_objects.meta_role import (
    MetaRole, 
    MetaRoleNew, 
    MetaRoleUpdate
)

from metacheck.schemas.base_objects.detection import (
    Detection,
    DetectionNew,
    DetectionUpdate,
)

from metacheck.schemas.base_objects.meta_element import (
    MetaElement, 
    MetaElementNew, 
    MetaElementUpdate
)

from metacheck.schemas.base_objects.collection import (
    Collection,
    CollectionNew,
    CollectionUpdate,
    CollectionHierarchical,
    DetectionHierarchical,
    MetaElementHierarchical
)

from metacheck.schemas.base_objects.image import (
    Image, 
    ImageUpdate
)

from metacheck.schemas.base_objects.meta_element_detection import (
    MetaElementDetection, 
    MetaElementDetectionNew, 
    MetaElementDetectionUpdate
)

# Create a globals dict for model_rebuild
globals_dict = globals()

# Update forward references to resolve circular dependencies
try:
    # Call model_rebuild for each model
    # The order doesn't matter as much since model_rebuild will search globals
    for model in [MetaElementDetection, Image, Collection, MetaElement, 
                Detection, MetaRole, MetaElementType, 
                MetaElementDetectionAttributeType]:
        try:
            model.model_rebuild()
        except Exception as e:
            # Continue even if one model fails
            import logging
            logging.debug(f"Error rebuilding model {model.__name__}: {e}")
except Exception as e:
    import logging
    logging.warning(f"Error during model rebuild: {e}")

__all__ = [
    BaseModel,
    "WorkState",
    "ProcessingState",
    "PageType",
    "BaseEntity",
    "Detection",
    "DetectionNew",
    "DetectionUpdate",
    "DetectionHierarchical",
    "Image",
    "ImageUpdate",
    "Collection",
    "CollectionNew",
    "CollectionUpdate",
    "CollectionHierarchical",
    "MetaElement",
    "MetaElementNew",
    "MetaElementUpdate",
    "MetaElementHierarchical",
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
