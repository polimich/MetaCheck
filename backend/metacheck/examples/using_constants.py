"""
Example demonstrating how to use the constants in the application.
"""
import uuid

# Import from the application constants 
from metacheck.constants import (
    META_ELEMENT_TYPE_IDS,
    META_ELEMENT_TYPE_NAMES,
    ElementTypeEnum,
    API_VERSION
)

# Also demonstrate using the constants source directly if needed
from metacheck.constants_source import (
    ELEMENT_TYPE_UUID_STRINGS,  # String UUIDs - use META_ELEMENT_TYPE_IDS instead in app code
    ELEMENT_COLORS,
    ELEMENT_ATTRIBUTE_MAPPINGS
)

# Import utility functions
from metacheck.utils.element_type_utils import (
    get_element_type_uuid,
    get_element_type_display_name,
    filter_elements_by_type
)


def demonstrate_constants_usage():
    """Demonstrate using the constants in application code."""
    print("\nConstants Usage Example")
    print("======================\n")
    
    # Using the element type UUIDs
    print("Element type UUIDs:")
    for element_type, element_uuid in META_ELEMENT_TYPE_IDS.items():
        print(f"  - {element_type}: {element_uuid}")
    print()
    
    # Using the enum
    print("Using the ElementTypeEnum:")
    print(f"  PAGE value: {ElementTypeEnum.PAGE.value}")
    print(f"  VOLUME value: {ElementTypeEnum.VOLUME.value}")
    print()
    
    # Using the utility functions
    print("Utility functions:")
    page_uuid = get_element_type_uuid("page")
    page_display_name = get_element_type_display_name("page")
    print(f"  Page UUID: {page_uuid}")
    print(f"  Page display name: {page_display_name}")
    print()
    
    # Using the attribute mappings
    print("Element attribute mappings:")
    for element_type, attributes in ELEMENT_ATTRIBUTE_MAPPINGS.items():
        print(f"  {element_type} attributes: {', '.join(attributes[:3])}...")
    print()
    
    # Using the colors
    print("Element colors:")
    for element_type, color in ELEMENT_COLORS.items():
        print(f"  {element_type}: {color}")
    print()


if __name__ == "__main__":
    demonstrate_constants_usage() 