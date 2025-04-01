import enum
import logging
import traceback
from typing import Dict, List, Optional, Tuple, Any, Literal, Type
from uuid import UUID

from pydantic import BaseModel, Field, model_validator, field_validator, ValidationInfo, TypeAdapter, create_model, Json

logger = logging.getLogger(__name__)


class ElementType(str, enum.Enum):
    TITLE = "title"
    VOLUME = "volume"
    ISSUE = "issue"
    PAGE = "page"
    SUPPLEMENT = "supplement"
    CHAPTER = "chapter"
    ARTICLE = "article"


# Base class for all element types
class MetaKatElement(BaseModel):
    id: UUID
    parent_id: Optional[UUID] = None
    
    # Common fields shared between different element types
    title: Optional[Tuple[str, float, UUID]] = None
    subTitle: Optional[Tuple[str, float, UUID]] = None
    partNumber: Optional[Tuple[str, float, UUID]] = None
    dateIssued: Optional[Tuple[str, float, UUID]] = None


# Define element types
class TitleElement(MetaKatElement):
    type: Literal["title"]
    periodical: bool = False  # Default value
    
    @field_validator('periodical', mode='before')
    @classmethod
    def convert_periodical(cls, v):
        """Convert periodical field to boolean"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', 'yes', '1')
        if isinstance(v, (int, float)):
            return bool(v)
        return False  # Default value


class VolumeElement(MetaKatElement):
    type: Literal["volume"]
    periodical: bool = False  # Default value
    partName: Optional[Tuple[str, float, UUID]] = None
    edition: Optional[Tuple[str, float, UUID]] = None
    placeTerm: Optional[Tuple[str, float, UUID]] = None
    publisher: Optional[List[Tuple[str, float, UUID]]] = None
    manufacturePublisher: Optional[List[Tuple[str, float, UUID]]] = None
    manufacturePlaceTerm: Optional[List[Tuple[str, float, UUID]]] = None
    author: Optional[List[Tuple[str, float, UUID]]] = None
    illustrator: Optional[List[Tuple[str, float, UUID]]] = None
    translator: Optional[List[Tuple[str, float, UUID]]] = None
    editor: Optional[List[Tuple[str, float, UUID]]] = None
    seriesName: Optional[List[Tuple[str, float, UUID]]] = None
    seriesNumber: Optional[List[Tuple[str, float, UUID]]] = None
    
    @field_validator('periodical', mode='before')
    @classmethod
    def convert_periodical(cls, v):
        """Convert periodical field to boolean"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', 'yes', '1')
        if isinstance(v, (int, float)):
            return bool(v)
        return False  # Default value
    
    @model_validator(mode='after')
    def validate_lists(self):
        """Ensure all list fields are properly initialized"""
        for field_name in [
            'publisher', 'manufacturePublisher', 'manufacturePlaceTerm',
            'author', 'illustrator', 'translator', 'editor', 
            'seriesName', 'seriesNumber'
        ]:
            # Convert None to empty list
            if getattr(self, field_name) is None:
                setattr(self, field_name, [])
                
            # Ensure all items are proper tuples
            valid_items = []
            for item in getattr(self, field_name, []):
                if isinstance(item, tuple) and len(item) >= 3:
                    valid_items.append(item)
            setattr(self, field_name, valid_items)
            
        return self


class IssueElement(MetaKatElement):
    type: Literal["issue"]
    placeTerm: Optional[Tuple[str, float, UUID]] = None
    publisher: Optional[List[Tuple[str, float, UUID]]] = None
    manufacturePublisher: Optional[List[Tuple[str, float, UUID]]] = None
    manufacturePlaceTerm: Optional[List[Tuple[str, float, UUID]]] = None
    redaktor: Optional[List[Tuple[str, float, UUID]]] = None
    
    @model_validator(mode='after')
    def validate_lists(self):
        """Ensure all list fields are properly initialized"""
        for field_name in ['publisher', 'manufacturePublisher', 'manufacturePlaceTerm', 'redaktor']:
            # Convert None to empty list
            if getattr(self, field_name) is None:
                setattr(self, field_name, [])
                
            # Ensure all items are proper tuples
            valid_items = []
            for item in getattr(self, field_name, []):
                if isinstance(item, tuple) and len(item) >= 3:
                    valid_items.append(item)
            setattr(self, field_name, valid_items)
            
        return self


class PageElement(MetaKatElement):
    type: Literal["page"]
    batch_id: Optional[UUID] = None
    pageIndex: Optional[int] = None
    pageNumber: Optional[Tuple[str, float, UUID]] = None
    pageType: Optional[Tuple[str, float]] = None


class SupplementElement(MetaKatElement):
    type: Literal["supplement"]
    author: Optional[List[Tuple[str, float, UUID]]] = None
    publisher: Optional[List[Tuple[str, float, UUID]]] = None
    placeTerm: Optional[Tuple[str, float, UUID]] = None
    
    @model_validator(mode='after')
    def validate_lists(self):
        """Ensure all list fields are properly initialized"""
        for field_name in ['author', 'publisher']:
            # Convert None to empty list
            if getattr(self, field_name) is None:
                setattr(self, field_name, [])
                
            # Ensure all items are proper tuples
            valid_items = []
            for item in getattr(self, field_name, []):
                if isinstance(item, tuple) and len(item) >= 3:
                    valid_items.append(item)
            setattr(self, field_name, valid_items)
            
        return self


class ChapterElement(MetaKatElement):
    type: Literal["chapter"]
    pageIndexStart: Optional[int] = None
    pageIndexEnd: Optional[int] = None


class ArticleElement(MetaKatElement):
    type: Literal["article"]
    pageIndexStart: Optional[int] = None
    pageIndexEnd: Optional[int] = None
    author: Optional[List[Tuple[str, float, UUID]]] = None
    abstract: Optional[Tuple[str, float, UUID]] = None
    keywords: Optional[Tuple[str, float, UUID]] = None
    
    @model_validator(mode='after')
    def validate_lists(self):
        """Ensure all list fields are properly initialized"""
        for field_name in ['author']:
            # Convert None to empty list
            if getattr(self, field_name) is None:
                setattr(self, field_name, [])
                
            # Ensure all items are proper tuples
            valid_items = []
            for item in getattr(self, field_name, []):
                if isinstance(item, tuple) and len(item) >= 3:
                    valid_items.append(item)
            setattr(self, field_name, valid_items)
            
        return self


# Element type registry for dynamic type conversion
ELEMENT_TYPE_MAP = {
    "title": TitleElement,
    "volume": VolumeElement,
    "issue": IssueElement,
    "page": PageElement,
    "supplement": SupplementElement,
    "chapter": ChapterElement,
    "article": ArticleElement
}


# Simplified Element Union type - will handle validation in the field validator
Element = Any


class MetaKatImport(BaseModel):
    """Data structure for importing from MetaKat application"""
    batch_id: UUID
    
    # Use List[Any] with a validator to handle parsing
    elements: List[Element] = Field(default_factory=list)
    
    # Mapping dictionaries for connecting detections to pages and metadata
    detection_to_page_mapping: Dict[str, str]
    page_to_alto_mapping: Optional[Dict[str, str]] = None
    page_to_image_mapping: Dict[str, str]
    detection_to_bbox: Dict[str, Tuple[float, float, float, float]]  # Always a tuple of 4 floats
    
    @field_validator('elements', mode='before')
    @classmethod
    def validate_elements(cls, v: Any, info: ValidationInfo) -> Any:
        """Transform and validate elements based on their type"""
        if not isinstance(v, list):
            logger.warning(f"Expected list for elements but got {type(v)}")
            return []
            
        result = []
        element_types_count = {}
        fallback_elements = {}
        errors_by_type = {}
        
        for i, item in enumerate(v):
            # Skip non-dict items
            if not isinstance(item, dict):
                logger.warning(f"Skipping non-dict element at index {i}")
                continue
                
            # Get element type
            elem_type = item.get('type')
            if not elem_type or not isinstance(elem_type, str):
                logger.warning(f"Element at index {i} has no valid 'type' field")
                continue
                
            # Count element types
            if elem_type not in element_types_count:
                element_types_count[elem_type] = 0
                errors_by_type[elem_type] = []
            element_types_count[elem_type] += 1
                
            # Find the appropriate model class
            model_cls = ELEMENT_TYPE_MAP.get(elem_type)
            if not model_cls:
                logger.warning(f"Unknown element type: {elem_type}")
                # Store for potential fallback processing
                if elem_type not in fallback_elements:
                    fallback_elements[elem_type] = []
                fallback_elements[elem_type].append(item)
                continue
                
            # Try to parse with the appropriate model
            try:
                # For volume elements, add extra debug info
                if elem_type == "volume":
                    logger.info(f"Processing volume element: {item}")
                    # Log required fields
                    if "periodical" not in item:
                        logger.warning(f"Volume element missing required 'periodical' field")
                        item["periodical"] = False  # Add default value
                
                element = model_cls.model_validate(item)
                result.append(element)
            except Exception as e:
                error_msg = f"Failed to validate element of type {elem_type} at index {i}: {e}"
                logger.warning(error_msg)
                errors_by_type[elem_type].append(error_msg)
                
                # Print more details for debugging
                if elem_type == "volume":
                    logger.warning(f"Volume validation error for item: {item}")
                    # Check for specific fields
                    for field in ["id", "type", "periodical"]:
                        logger.warning(f"Field '{field}': {item.get(field, 'MISSING')}")
                
                logger.debug(f"Element data: {item}")
                logger.debug(f"Validation error: {traceback.format_exc()}")
                
                # Try fallback for essential types
                if elem_type in ["page", "title", "volume"]:
                    try:
                        # Create a minimal valid element
                        if "id" in item:
                            elem_id = item["id"]
                            if isinstance(elem_id, str):
                                try:
                                    elem_id = UUID(elem_id)
                                except ValueError:
                                    continue
                            
                            # Create minimal element of the appropriate type
                            minimal_element = None
                            if elem_type == "page":
                                minimal_element = PageElement(
                                    id=elem_id,
                                    type="page",
                                )
                            elif elem_type == "volume":
                                minimal_element = VolumeElement(
                                    id=elem_id,
                                    type="volume",
                                    periodical=False,  # Default value
                                )
                            elif elem_type == "title":
                                minimal_element = TitleElement(
                                    id=elem_id,
                                    type="title",
                                    periodical=False,  # Default value
                                )
                                
                            if minimal_element:
                                result.append(minimal_element)
                                logger.info(f"Added minimal {elem_type} element for ID {elem_id}")
                    except Exception as fallback_error:
                        logger.warning(f"Fallback also failed: {fallback_error}")
        
        logger.info(f"Validated {len(result)} elements of {len(element_types_count)} types")
        for elem_type, count in element_types_count.items():
            successful = sum(1 for elem in result if elem.type == elem_type)
            logger.info(f"  - {elem_type}: {successful}/{count} elements validated")
            
            # If there were validation errors for this type, log some details
            if elem_type in errors_by_type and errors_by_type[elem_type]:
                error_count = len(errors_by_type[elem_type])
                if error_count > 0:
                    logger.info(f"    - {error_count} validation errors for {elem_type}")
                    if error_count <= 3:  # Only show first few errors
                        for error in errors_by_type[elem_type]:
                            logger.info(f"      - {error}")
                    else:
                        logger.info(f"      - First error: {errors_by_type[elem_type][0]}")
                        
        return result
    
    @model_validator(mode='before')
    @classmethod
    def validate_missing_mappings(cls, data: Dict) -> Dict:
        """Handle missing mapping fields by providing defaults"""
        if not isinstance(data, dict):
            return data
            
        # Provide empty defaults for missing mappings
        if 'detection_to_page_mapping' not in data:
            logger.warning("detection_to_page_mapping is missing, using empty dict")
            data['detection_to_page_mapping'] = {}
            
        if 'page_to_image_mapping' not in data:
            logger.warning("page_to_image_mapping is missing, using empty dict")
            data['page_to_image_mapping'] = {}
            
        if 'detection_to_bbox' not in data:
            logger.warning("detection_to_bbox is missing, using empty dict")
            data['detection_to_bbox'] = {}
            
        return data
            
    @model_validator(mode='after')
    def validate_structure(self):
        """Validate overall structure and relationships"""
        # Validate element references
        element_ids = {str(elem.id): elem.type for elem in self.elements}
        
        # Check parent_id references
        for elem in self.elements:
            if elem.parent_id and str(elem.parent_id) not in element_ids:
                logger.warning(f"Element {elem.id} references non-existent parent {elem.parent_id}")
        
        # Check page mappings
        page_ids = {str(elem.id) for elem in self.elements if elem.type == "page"}
        
        missing_pages = set()
        for detection_id, page_id in self.detection_to_page_mapping.items():
            if page_id not in page_ids:
                missing_pages.add(page_id)
                
        if missing_pages and len(missing_pages) > 10:
            logger.warning(f"Found {len(missing_pages)} referenced pages that do not exist in elements")
            logger.warning(f"First 10 missing pages: {list(missing_pages)[:10]}")
            
        return self
    
    @model_validator(mode='after')
    def validate_uuids(self):
        """Validate that all UUIDs in mapping dictionaries are valid"""
        # Process detection_to_page_mapping
        validated_detection_to_page = {}
        for k, v in self.detection_to_page_mapping.items():
            # Convert string UUIDs to actual UUID objects if needed
            try:
                key_uuid = UUID(k) if isinstance(k, str) else k
                value = v  # Keep as string for compatibility
                validated_detection_to_page[key_uuid] = value
            except ValueError as e:
                logger.warning(f"Invalid UUID in detection_to_page_mapping: {k} - {e}")
                
        self.detection_to_page_mapping = validated_detection_to_page
        
        # Process page_to_image_mapping
        validated_page_to_image = {}
        for k, v in self.page_to_image_mapping.items():
            try:
                key_uuid = UUID(k) if isinstance(k, str) else k
                validated_page_to_image[key_uuid] = v
            except ValueError as e:
                logger.warning(f"Invalid UUID in page_to_image_mapping: {k} - {e}")
                
        self.page_to_image_mapping = validated_page_to_image
        
        # Process detection_to_bbox
        validated_detection_to_bbox = {}
        for k, v in self.detection_to_bbox.items():
            try:
                key_uuid = UUID(k) if isinstance(k, str) else k
                # Ensure v is a tuple of 4 floats
                if not isinstance(v, tuple) or len(v) != 4:
                    logger.warning(f"Invalid bbox format for detection {k}: {v}")
                    continue
                validated_detection_to_bbox[key_uuid] = v
            except ValueError as e:
                logger.warning(f"Invalid UUID in detection_to_bbox: {k} - {e}")
                
        self.detection_to_bbox = validated_detection_to_bbox
        
        # Process page_to_alto_mapping if it exists
        if self.page_to_alto_mapping:
            validated_page_to_alto = {}
            for k, v in self.page_to_alto_mapping.items():
                try:
                    key_uuid = UUID(k) if isinstance(k, str) else k
                    validated_page_to_alto[key_uuid] = v
                except ValueError as e:
                    logger.warning(f"Invalid UUID in page_to_alto_mapping: {k} - {e}")
                    
            self.page_to_alto_mapping = validated_page_to_alto
        
        return self

    @model_validator(mode='after')
    def convert_bbox_lists_to_tuples(self):
        """Convert bbox lists to tuples for consistency"""
        converted_bbox_map = {}
        for detection_id, bbox in self.detection_to_bbox.items():
            if isinstance(bbox, list) and len(bbox) >= 4:
                # Convert list to tuple with 4 float values
                converted_bbox_map[detection_id] = (
                    float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
                )
            elif isinstance(bbox, tuple) and len(bbox) >= 4:
                # Already a tuple, just ensure they're all floats
                converted_bbox_map[detection_id] = (
                    float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
                )
            else:
                logger.warning(f"Invalid bbox format for detection {detection_id}: {bbox}")
                # Use zeros as fallback to avoid errors
                converted_bbox_map[detection_id] = (0.0, 0.0, 0.0, 0.0)
                
        self.detection_to_bbox = converted_bbox_map
        return self 