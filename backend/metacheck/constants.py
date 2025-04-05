"""
Constants for the MetaCheck application.
These constants can be accessed from anywhere in the application.
"""
import uuid
from enum import Enum, auto
from typing import Dict, Any, Optional

# Import from the shared constants source file
from metacheck.constants_source import (
    ELEMENT_TYPE_UUID_STRINGS,
    ATTRIBUTE_TYPES,
    ELEMENT_COLORS,
    ELEMENT_ATTRIBUTE_MAPPINGS
)

# Meta Element Type UUIDs
# These must match the UUIDs used in the alembic migration '67208458c241_seed_meta_initial_data.py'
META_ELEMENT_TYPE_IDS = {
    k: uuid.UUID(v) for k, v in ELEMENT_TYPE_UUID_STRINGS.items()
}

# Create a reverse mapping from UUID to type name
META_ELEMENT_TYPE_NAMES = {str(v): k for k, v in META_ELEMENT_TYPE_IDS.items()}


class ElementTypeEnum(str, Enum):
    """Enum for element types."""
    PAGE = "page"
    TITLE = "title"
    VOLUME = "volume"
    ISSUE = "issue"
    SUPPLEMENT = "supplement"
    CHAPTER = "chapter"
    ARTICLE = "article"
    
    @classmethod
    def get_uuid(cls, element_type: str) -> Optional[uuid.UUID]:
        """Get the UUID for an element type."""
        return META_ELEMENT_TYPE_IDS.get(element_type)
    
    @classmethod
    def from_uuid(cls, uuid_value: uuid.UUID) -> Optional[str]:
        """Get the element type name from a UUID."""
        return META_ELEMENT_TYPE_NAMES.get(str(uuid_value))


# Configuration constants
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# File paths and directories
UPLOAD_DIR = "uploads"
TEMP_DIR = "temp"

# API related constants
API_VERSION = "1.0.0"
API_PREFIX = "/api"

# Feature flags
ENABLE_CACHING = True
DEBUG_MODE = False 