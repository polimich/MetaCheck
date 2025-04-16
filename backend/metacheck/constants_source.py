"""
Constants source definitions that can be shared between migrations and application code.
IMPORTANT: This file must NOT have any dependencies on SQLAlchemy, models, or anything 
besides standard Python libraries, as it needs to be importable from migrations.
"""

# Element type UUIDs as string literals
# These are shared between the application constants and the migrations
ELEMENT_TYPE_UUID_STRINGS = {
    "title": "e1000000-0000-4000-a000-000000000002",
    "volume": "e1000000-0000-4000-a000-000000000003",
    "issue": "e1000000-0000-4000-a000-000000000004",
    "supplement": "e1000000-0000-4000-a000-000000000005",
    "chapter": "e1000000-0000-4000-a000-000000000006",
    "article": "e1000000-0000-4000-a000-000000000007"
}

# List of possible attribute types
ATTRIBUTE_TYPES = [
    "title", 
    "sub_title", 
    "author", 
    "editor", 
    "publisher", 
    "date_issued", 
    "place_term", 
    "part_number", 
    "part_name", 
    "edition",  
    "manufacture_publisher", 
    "manufacture_place_term", 
    "illustrator", 
    "translator", 
    "redaktor", 
    "series_name", 
    "series_number", 
    "abstract", 
    "keywords",
    "page_number"
]

# Base colors for element types
ELEMENT_COLORS = {
    "page": "#39A40B",      # Green
    "title": "#9B372A",     # Dark Red
    "volume": "#3643F5",    # Blue
    "issue": "#8B4513",     # Brown
    "supplement": "#FF7F50", # Coral
    "chapter": "#003B56",   # Dark Blue
    "article": "#CCA19F"    # Pinkish
}

# Element-attribute mappings
VOLUME_ATTRIBUTES = [
    "title", "sub_title", "author", "editor", "date_issued",
    "publisher", "part_name", "edition", 
    "place_term", "manufacture_publisher", "manufacture_place_term",
    "illustrator", "translator", "series_name", "series_number"
]

ELEMENT_ATTRIBUTE_MAPPINGS = {
    "page": ["page_number"],
    "title": VOLUME_ATTRIBUTES,
    "volume": VOLUME_ATTRIBUTES,
    "issue": [
        "title", "sub_title", "part_number", "date_issued", "place_term", "publisher",
        "manufacture_publisher", "manufacture_place_term", 
        "redaktor"
    ],
    "chapter": ["title", "sub_title", "part_number"],
    "article": ["title", "author", "abstract", "keywords"],
    "supplement": ["title", "sub_title", "part_number", "date_issued", "author", "publisher", "place_term"]
} 