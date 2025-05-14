# Author: Michael Polívka xpoliv07
# Summary: Utility functions for working with element types, providing type conversion and validation.

"""
Utility functions for working with element types.
"""
import uuid
from typing import Dict, List, Optional, Any, Union

from metacheck.constants import META_ELEMENT_TYPE_IDS, META_ELEMENT_TYPE_NAMES, ElementTypeEnum


def is_valid_element_type(element_type: str) -> bool:
    """Check if an element type is valid."""
    return element_type in META_ELEMENT_TYPE_IDS


def get_element_type_uuid(element_type: str) -> Optional[uuid.UUID]:
    """Get the UUID for an element type."""
    return META_ELEMENT_TYPE_IDS.get(element_type)


def get_element_type_from_uuid(element_uuid: uuid.UUID) -> Optional[str]:
    """Get the element type name from a UUID."""
    return META_ELEMENT_TYPE_NAMES.get(str(element_uuid))


def get_all_element_types() -> List[str]:
    """Get a list of all element types."""
    return list(META_ELEMENT_TYPE_IDS.keys())


def get_all_element_uuids() -> List[uuid.UUID]:
    """Get a list of all element UUIDs."""
    return list(META_ELEMENT_TYPE_IDS.values())


def get_element_enum(element_type: str) -> Optional[ElementTypeEnum]:
    """Get the ElementTypeEnum value for an element type."""
    try:
        return ElementTypeEnum(element_type)
    except ValueError:
        return None


def get_element_type_display_name(element_type: str) -> str:
    """Get a human-readable display name for an element type."""
    try:
        enum_value = ElementTypeEnum(element_type)
        return enum_value.name.replace('_', ' ').title()
    except ValueError:
        return element_type.replace('_', ' ').title()


def filter_elements_by_type(elements: List[Dict[str, Any]], element_type: str) -> List[Dict[str, Any]]:
    """
    Filter a list of elements by type.
    
    Args:
        elements: List of element dictionaries with a 'meta_element_type_id' field
        element_type: The element type to filter by (e.g., 'page', 'volume')
        
    Returns:
        List of elements of the specified type
    """
    type_uuid = get_element_type_uuid(element_type)
    if not type_uuid:
        return []
    
    return [elem for elem in elements if elem.get('meta_element_type_id') == type_uuid]


def get_element_type_from_element(element: Dict[str, Any]) -> Optional[str]:
    """
    Get the element type name from an element dictionary.
    
    Args:
        element: Element dictionary with a 'meta_element_type_id' field
        
    Returns:
        Element type name or None if not found
    """
    type_id = element.get('meta_element_type_id')
    if not type_id:
        return None
    
    return get_element_type_from_uuid(type_id)


# Example usage demonstration
def demo_element_types() -> None:
    """Demonstrate the use of element type utilities."""
    print("Element Types Demo")
    print("-----------------")
    
    # Get all element types
    print("All element types:", get_all_element_types())
    
    # Get UUID for a specific element type
    page_uuid = get_element_type_uuid("page")
    print("UUID for 'page':", page_uuid)
    
    # Get element type from UUID
    element_type = get_element_type_from_uuid(page_uuid)
    print("Element type for UUID:", element_type)
    
    # Check if an element type is valid
    print("Is 'page' a valid element type?", is_valid_element_type("page"))
    print("Is 'invalid' a valid element type?", is_valid_element_type("invalid"))
    
    # Using the enum
    print("ElementTypeEnum.PAGE:", ElementTypeEnum.PAGE)
    print("ElementTypeEnum.PAGE.value:", ElementTypeEnum.PAGE.value)
    print("ElementTypeEnum.PAGE name:", ElementTypeEnum.PAGE.name)
    
    # Get display name
    print("Display name for 'page':", get_element_type_display_name("page"))
    
    # Example data
    example_elements = [
        {"id": uuid.uuid4(), "meta_element_type_id": META_ELEMENT_TYPE_IDS["page"], "name": "Page 1"},
        {"id": uuid.uuid4(), "meta_element_type_id": META_ELEMENT_TYPE_IDS["volume"], "name": "Volume 1"},
        {"id": uuid.uuid4(), "meta_element_type_id": META_ELEMENT_TYPE_IDS["page"], "name": "Page 2"},
    ]
    
    # Filter elements by type
    pages = filter_elements_by_type(example_elements, "page")
    print(f"Found {len(pages)} pages:", [p["name"] for p in pages])
    
    # Get element type from element
    element_type = get_element_type_from_element(example_elements[0])
    print(f"Element type for {example_elements[0]['name']}:", element_type)


if __name__ == "__main__":
    demo_element_types() 