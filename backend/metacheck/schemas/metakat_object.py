from __future__ import annotations

import json
import sys
import os
from enum import Enum
from typing import List, Dict, Tuple, Optional, Union, get_args, get_origin
from uuid import UUID, uuid4

from pydantic import BaseModel, field_validator, model_serializer

# Add the parent directory to sys.path for direct script execution
if __name__ == "__main__":
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from metacheck.schemas.base_objects.enums import PageType


#
# 1. Enums & Helper Types
#


class ElementType(str, Enum):
    title = "title"
    volume = "volume"
    issue = "issue"
    page = "page"
    supplement = "supplement"
    chapter = "chapter"
    article = "article"


# A detection: ("text", 0.9, detection_uuid)
Detection = Tuple[str, float, UUID]
# A PageType detection: (PageType, confidence)
PageTypeDetection = Tuple[PageType, float]


#
# 2. Base models
#


class BaseElement(BaseModel):
    """
    Shared fields among all element types.
    Note we do NOT define `type` here as an Enum,
    but as a Literal in each subclass.
    """

    id: UUID
    parent_id: Optional[UUID] = None


class SharedFields(BaseModel):
    edition: Optional[List[Detection]] = None
    publisher: Optional[List[Detection]] = None
    placeTerm: Optional[Detection] = None
    manufacturePublisher: Optional[List[Detection]] = None
    manufacturePlaceTerm: Optional[List[Detection]] = None
    author: Optional[List[Detection]] = None
    illustrator: Optional[List[Detection]] = None
    translator: Optional[List[Detection]] = None
    editor: Optional[List[Detection]] = None
    seriesName: Optional[List[Detection]] = None
    seriesNumber: Optional[List[Detection]] = None


#
# 3. Element type models
#


class TitleElement(BaseElement, SharedFields):
    type: ElementType = ElementType.title
    periodical: Optional[bool] = None

    # Fields that typically appear in "title" elements
    title: Optional[Detection] = None
    subTitle: Optional[Detection] = None
    dateIssued: Optional[Detection] = None
    partNumber: Optional[Detection] = None


class VolumeElement(BaseElement, SharedFields):
    type: ElementType = ElementType.volume
    periodical: Optional[bool] = None

    # Possibly shared with Title?
    title: Optional[Detection] = None
    subTitle: Optional[Detection] = None

    partNumber: Optional[Detection] = None
    partName: Optional[Detection] = None
    dateIssued: Optional[Detection] = None


class IssueElement(BaseElement):
    type: ElementType = ElementType.issue

    partNumber: Optional[Detection] = None
    dateIssued: Optional[Detection] = None

    title: Optional[Detection] = None
    subTitle: Optional[Detection] = None

    placeTerm: Optional[List[Detection]] = None
    publisher: Optional[List[Detection]] = None
    manufacturePublisher: Optional[List[Detection]] = None
    manufacturePlaceTerm: Optional[List[Detection]] = None

    redaktor: Optional[List[Detection]] = None


class PageElement(BaseElement):
    type: ElementType = ElementType.page

    batch_id: Optional[UUID] = None
    pageIndex: Optional[int] = None
    pageNumber: Optional[Detection] = None
    pageType: Optional[PageTypeDetection] = None


class SupplementElement(BaseElement):
    type: ElementType = ElementType.supplement

    title: Optional[Detection] = None
    subTitle: Optional[Detection] = None
    partNumber: Optional[Detection] = None
    dateIssued: Optional[Detection] = None

    author: Optional[List[Detection]] = None
    publisher: Optional[List[Detection]] = None
    placeTerm: Optional[Detection] = None


class ChapterElement(BaseElement):
    type: ElementType = ElementType.chapter

    pageIndexStart: Optional[int] = None
    pageIndexEnd: Optional[int] = None

    title: Optional[Detection] = None
    subTitle: Optional[Detection] = None
    partNumber: Optional[Detection] = None


class ArticleElement(BaseElement):
    type: ElementType = ElementType.article

    pageIndexStart: Optional[int] = None
    pageIndexEnd: Optional[int] = None

    title: Optional[Detection] = None
    author: Optional[List[Detection]] = None
    abstract: Optional[Detection] = None
    keywords: Optional[Detection] = None


# Map from ElementType to corresponding model class
TYPE_TO_CLASS = {
    ElementType.title: TitleElement,
    ElementType.volume: VolumeElement,
    ElementType.issue: IssueElement,
    ElementType.page: PageElement,
    ElementType.supplement: SupplementElement,
    ElementType.chapter: ChapterElement,
    ElementType.article: ArticleElement,
}


#
# 4. Helper functions for MetaKatImport
#


def camel_to_snake(name):
    """Convert camelCase to snake_case"""
    import re
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()


def transform_detection(detection, detection_to_bbox):
    """Transform a single Detection into a dictionary"""
    if detection is None:
        return None
    
    text_value, confidence, det_uuid = detection
    bbox = detection_to_bbox.get(det_uuid)
    return {
        "id": str(det_uuid),
        "value": text_value,
        "confidence": confidence,
        "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}" if bbox else None
    }


def transform_page_type_detection(detection):
    """Transform a PageTypeDetection into a dictionary"""
    if detection is None:
        return None
    
    page_type_enum, confidence = detection
    return {
        "value": page_type_enum.value,
        "confidence": confidence,
    }


def transform_value_by_annotation(value, annotation, detection_to_bbox):
    """Transform a value based on its type annotation"""
    if value is None:
        return None

    origin = get_origin(annotation)
    args = get_args(annotation)
    
    # Handle Optional types
    if origin is Union and type(None) in args:
        non_none_args = [a for a in args if a is not type(None)]
        if len(non_none_args) == 1:
            return transform_value_by_annotation(value, non_none_args[0], detection_to_bbox)
        return value
    
    # Handle specific types
    if annotation == Detection:
        return transform_detection(value, detection_to_bbox)
    if annotation == List[Detection]:
        return [transform_detection(v, detection_to_bbox) for v in value]
    if annotation == PageTypeDetection:
        return transform_page_type_detection(value)
    
    return value


def extract_detections_from_element(element, detection_to_bbox, detection_to_page_mapping):
    """Extract all detections from an element"""
    data = element.model_dump(mode="python")
    model_fields = type(element).model_fields
    detections = []
    
    for field_name, field_info in model_fields.items():
        if field_name not in data:
            continue
            
        value = data[field_name]
        snake_field_name = camel_to_snake(field_name)
        
        # Single detection
        if isinstance(value, tuple) and len(value) == 3 and isinstance(value[0], str) and \
           isinstance(value[1], float) and isinstance(value[2], UUID):
            text, confidence, detection_uuid = value
            bbox = detection_to_bbox.get(detection_uuid)
            page_id = detection_to_page_mapping.get(detection_uuid)
            
            # Only add detections with a bbox
            if bbox:
                detection_data = {
                    "id": str(detection_uuid),
                    "value": text,
                    "confidence": confidence,
                    "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}" if bbox else None,
                    "parent_element_id": str(data.get("id")),
                    "element_type": data.get("type"),
                    "meta_attribute_type": snake_field_name,
                    "page_id": page_id
                }
                detections.append(detection_data)
        
        # List of detections
        elif isinstance(value, list) and value and isinstance(value[0], tuple):
            for det in value:
                if isinstance(det, tuple) and len(det) == 3 and \
                   isinstance(det[0], str) and isinstance(det[1], float) and \
                   isinstance(det[2], UUID):
                    text, confidence, detection_uuid = det
                    bbox = detection_to_bbox.get(detection_uuid)
                    page_id = detection_to_page_mapping.get(detection_uuid)
                    
                    # Only add detections with a bbox
                    if bbox:
                        detection_data = {
                            "id": str(detection_uuid),
                            "value": text,
                            "confidence": confidence,
                            "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}" if bbox else None,
                            "parent_element_id": str(data.get("id")),
                            "element_type": data.get("type"),
                            "meta_attribute_type": snake_field_name,
                            "page_id": page_id
                        }
                        detections.append(detection_data)
    
    return detections


def transform_element_for_output(element, detection_to_bbox, page_to_image_mapping):
    """Transform an element for output"""
    data = element.model_dump(mode="python")
    model_fields = type(element).model_fields
    
    # Transform fields based on their type
    for field_name, field_info in model_fields.items():
        if field_name in data:
            annotation = field_info.annotation
            original_value = data[field_name]
            transformed_value = transform_value_by_annotation(original_value, annotation, detection_to_bbox)
            data[field_name] = transformed_value
    
    # Convert IDs to strings
    if "id" in data and data["id"] is not None:
        data["id"] = str(data["id"])
    if "parent_id" in data and data["parent_id"] is not None:
        data["parent_id"] = str(data["parent_id"])
    
    # Convert enum types to strings
    if "type" in data and hasattr(data["type"], "value"):
        data["type"] = data["type"].value
    
    # Add image_path for page elements
    if data.get("type") == ElementType.page.value and data.get("id"):
        page_id = UUID(data["id"])
        if page_to_image_mapping and page_id in page_to_image_mapping:
            data["image_path"] = page_to_image_mapping[page_id]
    
    return data


#
# 5. The Top-level MetaKatImport model
#


class MetaKatImport(BaseModel):
    batch_id: UUID

    # We'll store the raw items in "elements" as dicts, then transform
    # them into typed models in our validator.
    elements: List[dict]

    # The various detection / page mappings
    detection_to_page_mapping: Optional[Dict[UUID, str]]
    page_to_alto_mapping: Optional[Dict[UUID, str]]
    page_to_image_mapping: Optional[Dict[UUID, str]]
    detection_to_bbox: Optional[Dict[UUID, Tuple[float, float, float, float]]]

    @field_validator("elements")
    def parse_elements(cls, v):
        """Parse and validate elements based on their type"""
        parsed = []
        
        for item in v:
            type_str = item.get("type")
            if not type_str:
                raise ValueError("Missing 'type' in element data.")

            try:
                etype = ElementType(type_str)
            except ValueError:
                raise ValueError(f"Unknown element type: {type_str!r}")

            model_cls = TYPE_TO_CLASS.get(etype)
            if not model_cls:
                raise ValueError(f"No Pydantic model registered for element type: {type_str}")

            parsed_element = model_cls(**item)
            parsed.append(parsed_element)

        return parsed

    @model_serializer(mode="plain")
    def _serialize(self):
        """Serialize the model with properly formatted detection fields"""
        # Categorized collections
        elements_by_type = {etype.value: [] for etype in ElementType}
        all_detections = []
        
        # Process each element
        for element in self.elements:
            # Extract all detections
            detections = extract_detections_from_element(
                element, 
                self.detection_to_bbox or {}, 
                self.detection_to_page_mapping or {}
            )
            all_detections.extend(detections)
            
            # Transform the element for output
            element_data = transform_element_for_output(
                element,
                self.detection_to_bbox or {},
                self.page_to_image_mapping or {}
            )
            
            # Add to type-specific collection
            element_type = element_data.get("type")
            if element_type in elements_by_type:
                elements_by_type[element_type].append(element_data)
        
        # Build final output structure
        result = {
            "batch_id": str(self.batch_id),
            "volumes": elements_by_type[ElementType.volume.value],
            "issues": elements_by_type[ElementType.issue.value],
            "titles": elements_by_type[ElementType.title.value],
            "pages": elements_by_type[ElementType.page.value],
            "supplements": elements_by_type[ElementType.supplement.value],
            "chapters": elements_by_type[ElementType.chapter.value],
            "articles": elements_by_type[ElementType.article.value],
            "detections": all_detections,
        }
        
        # Add page_to_alto_mapping if it exists
        if self.page_to_alto_mapping:
            result["page_to_alto_mapping"] = {
                str(k): v for k, v in self.page_to_alto_mapping.items()
            }
            
        return result


#
# 6. Demonstration
#


def main():
    with open(
        "/Users/michaelpolivka/PycharmProjects/MetaCheck/output_samples/monograph/0b1cb770-d7e7-11ea-9c41-005056827e52.97b800fd-3b9b-47ab-8133-c5911a630163.json",
        "r",
        encoding="utf-8",
    ) as f:
        sample_data = json.load(f)

    # Parse/validate
    metakat = MetaKatImport.model_validate(sample_data)

    # Serialize to JSON
    serialized = metakat.model_dump_json(indent=2)
    
    output_file_path = "./out.json"
    with open(output_file_path, "w", encoding="utf-8") as output_file:
        output_file.write(serialized)
    print(f"Data exported to {output_file_path}")


if __name__ == "__main__":
    sys.exit(main())
