from __future__ import annotations

import json
import sys
from enum import Enum
from pprint import pprint
from typing import List, Dict, Tuple, Optional, Union, get_args, get_origin
from uuid import UUID

from pydantic import BaseModel, field_validator, model_serializer


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


class PageType(str, Enum):
    Abstract = "Abstract"
    Advertisement = "Advertisement"
    Appendix = "Appendix"
    BackCover = "BackCover"
    BackEndPaper = "BackEndPaper"
    BackEndSheet = "BackEndSheet"
    Bibliography = "Bibliography"
    Blank = "Blank"
    CalibrationTable = "CalibrationTable"
    Cover = "Cover"
    CustomInclude = "CustomInclude"
    Dedication = "Dedication"
    Edge = "Edge"
    Errata = "Errata"
    FlyLeaf = "FlyLeaf"
    FragmentsOfBookbinding = "FragmentsOfBookbinding"
    FrontCover = "FrontCover"
    FrontEndPaper = "FrontEndPaper"
    FrontEndSheet = "FrontEndSheet"
    FrontJacket = "FrontJacket"
    Frontispiece = "Frontispiece"
    Illustration = "Illustration"
    Impressum = "Impressum"
    Imprimatur = "Imprimatur"
    Index = "Index"
    Jacket = "Jacket"
    ListOfIllustrations = "ListOfIllustrations"
    ListOfMaps = "ListOfMaps"
    ListOfTables = "ListOfTables"
    Map = "Map"
    NormalPage = "NormalPage"
    Obituary = "Obituary"
    Preface = "Preface"
    SheetMusic = "SheetMusic"
    Spine = "Spine"
    Table = "Table"
    TableOfContents = "TableOfContents"
    TitlePage = "TitlePage"


# A detection: ("text", 0.9, detection_uuid)
Detection = Tuple[str, float, UUID]
# A PageType detection: (PageType, confidence)
PageTypeDetection = Tuple[PageType, float]


#
# 2. Separate models for each element type
#


class BaseElement(BaseModel):
    """
    Shared fields among all element types.
    Note we do NOT define `type` here as an Enum,
    but as a Literal in each subclass.
    """

    id: UUID
    parent_id: Optional[UUID] = None


#
# 3. Specialized Classes
#


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


#
# 3. A lookup table from ElementType -> Pydantic Model
#
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
# 4. The Top-level MetaKatImport model
#    "elements" is a list of dicts that we parse manually in a validator.
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
        """
        This validator will run for the raw 'elements' field.
        For each item in the list, we look at item['type']
        and instantiate the correct Pydantic subclass from TYPE_TO_CLASS.
        """
        parsed = []
        for item in v:
            type_str = item.get("type")
            if not type_str:
                raise ValueError("Missing 'type' in element data.")

            try:
                # Convert the string to our ElementType enum
                etype = ElementType(type_str)
            except ValueError:
                raise ValueError(f"Unknown element type: {type_str!r}")

            # Look up the correct subclass
            model_cls = TYPE_TO_CLASS.get(etype)
            if not model_cls:
                raise ValueError(
                    f"No Pydantic model registered for element type: {type_str}"
                )

            # Instantiate that subclass (which validates further)
            parsed_element = model_cls(**item)
            parsed.append(parsed_element)

        # Return the typed list of elements
        return parsed

    @model_serializer(mode="plain")
    def _serialize(self):
        """
        Whenever we do `metakat.model_dump()`, this returns a dict where
        each detection field is turned into {value, confidence, bbox=...}.
        """

        def transform_single_detection(d: Optional[Detection]) -> Optional[dict]:
            """
            For a single detection (text, conf, detection_uuid),
            look up bbox in detection_to_bbox.
            """
            if d is None:
                return None
            text_value, confidence, det_uuid = d
            bbox = self.detection_to_bbox.get(det_uuid)
            return {
                "value": text_value,
                "confidence": confidence,
                "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}" if bbox else None,
            }

        def transform_page_type_detection(pt):
            if pt is None:
                return None
            # 'pt' is e.g. (PageType.NormalPage, 0.98)
            page_type_enum, confidence = pt
            return {
                "value": page_type_enum.value,  # or str(page_type_enum)
                "confidence": confidence,
            }

        def transform_any(value, annotation):
            """
            Inspect 'annotation' to see if it's:
            - A single Detection
            - A list of Detections
            Then transform accordingly.
            """
            if value is None:
                return None

            origin = get_origin(annotation)
            args = get_args(annotation)
            
            if origin is Union and type(None) in args:
                # e.g. annotation = Union[List[Detection], None]
                non_none_args = [a for a in args if a is not type(None)]
                if len(non_none_args) == 1:
                    # The "real" type is the single non-None arg
                    real_type = non_none_args[0]
                    return transform_any(value, real_type)
                else:
                    # If there's more than one non-None arg, your annotation is 
                    # e.g. Union[X, Y, None]. We'll just return value as-is or 
                    # handle it in a more advanced way if needed.
                    return value
            
            if annotation == Detection:
                return transform_single_detection(value)
            if annotation == List[Detection]:
                return [transform_single_detection(v) for v in value]
            if annotation == PageTypeDetection:
                return transform_page_type_detection(value)
            return value

        elements_output = []
        
        # Group elements by type
        volumes = []
        issues = []
        titles = []
        pages = []
        supplements = []
        chapters = []
        articles = []

        # 1) Iterate over each element object in 'self.elements'
        for elem in self.elements:
            data = elem.model_dump(mode="python")

            # Use the Pydantic v2 API: model_fields
            model_fields = type(elem).model_fields

            for field_name, field_info in model_fields.items():
                if field_name in data:
                    annotation = field_info.annotation
                    data[field_name] = transform_any(data[field_name], annotation)
            # Convert IDs or Enums to strings if desired
            # e.g. 'id' -> str
            if "id" in data and data["id"] is not None:
                data["id"] = str(data["id"])
            if "parent_id" in data and data["parent_id"] is not None:
                data["parent_id"] = str(data["parent_id"])
            if "type" in data and hasattr(data["type"], "value"):
                # If type is an enum, convert to string
                data["type"] = data["type"].value

            # Add image_path for page elements
            if data.get("type") == ElementType.page.value and data.get("id"):
                page_id = UUID(data["id"])
                if self.page_to_image_mapping and page_id in self.page_to_image_mapping:
                    data["image_path"] = self.page_to_image_mapping[page_id]

            # Add to elements output and to the type-specific collections
            elements_output.append(data)
            
            # Add to appropriate type-specific list
            element_type = data.get("type")
            if element_type == ElementType.volume.value:
                volumes.append(data)
            elif element_type == ElementType.issue.value:
                issues.append(data)
            elif element_type == ElementType.title.value:
                titles.append(data)
            elif element_type == ElementType.page.value:
                pages.append(data)
            elif element_type == ElementType.supplement.value:
                supplements.append(data)
            elif element_type == ElementType.chapter.value:
                chapters.append(data)
            elif element_type == ElementType.article.value:
                articles.append(data)

        # 3) Build the final top-level dict
        return {
            "batch_id": str(self.batch_id),
            "volumes": volumes,
            "issues": issues,
            "titles": titles,
            "pages": pages,
            "supplements": supplements,
            "chapters": chapters,
            "articles": articles,
            "detection_to_page_mapping": {
                str(k): v for k, v in self.detection_to_page_mapping.items()
            },
            "page_to_alto_mapping": (
                {str(k): v for k, v in self.page_to_alto_mapping.items()}
                if self.page_to_alto_mapping
                else None
            ),
            "detection_to_bbox": {str(k): v for k, v in self.detection_to_bbox.items()},
        }


#
# 5. Demonstration
#


def main():
    with open(
        "/Users/michaelpolivka/PycharmProjects/MetaCheck/output_samples/monograph/0b1cb770-d7e7-11ea-9c41-005056827e52.97b800fd-3b9b-47ab-8133-c5911a630163.json",
        "r",
        encoding="utf-8",
    ) as f:
        sample_data = json.load(f)

    # Now parse/validate
    metakat = MetaKatImport.model_validate(sample_data)

    serialized = metakat.model_dump_json(indent=2)
    json_serialized = serialized
    
    output_file_path = "./out.json"  # Specify the output file path
    with open(output_file_path, "w", encoding="utf-8") as output_file:
        output_file.write(json_serialized)
    print(f"Data exported to {output_file_path}")


if __name__ == "__main__":
    sys.exit(main())
