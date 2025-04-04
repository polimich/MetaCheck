"""seed_meta_initial_data

Revision ID: 67208458c241
Revises: 971ed423ad59
Create Date: 2025-04-04 22:46:00.000000

"""
from typing import Union, Sequence
from datetime import datetime
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = '67208458c241'
down_revision: Union[str, None] = '971ed423ad59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define element types with constant UUIDs
element_types = {
    "page": "e1000000-0000-4000-a000-000000000001",
    "title": "e1000000-0000-4000-a000-000000000002",
    "volume": "e1000000-0000-4000-a000-000000000003",
    "issue": "e1000000-0000-4000-a000-000000000004",
    "supplement": "e1000000-0000-4000-a000-000000000005",
    "chapter": "e1000000-0000-4000-a000-000000000006",
    "article": "e1000000-0000-4000-a000-000000000007"
}

attribute_types = ["page_number", "title", "sub_title", "page_type", "author", "editor", "publisher", 
        "date_issued", "place_term", "part_number", "part_name", "edition",  
        "manufacture_publisher", "manufacture_place_term", "illustrator", 
        "translator", "redaktor", "series_name", "series_number", "abstract", 
        "keywords"]


def generate_default_color(element_type: str, attribute_type: str) -> str:
    """Generate a default color for a role based on element type and attribute type"""
    # Define base colors for element types
    element_colors = {
        "page": "#39A40B",      # Green
        "title": "#9B372A",     # Dark Red
        "volume": "#3643F5",    # Blue
        "issue": "#8B4513",     # Brown
        "supplement": "#FF7F50", # Coral
        "chapter": "#003B56",   # Dark Blue
        "article": "#CCA19F"    # Pinkish
    }
    
    # Get base color or default to gray
    base_color = element_colors.get(element_type, "#808080")
    
    # Create a unique hash value for each attribute within an element type
    # This ensures consistent but different colors for each attribute
    attribute_index = hash(attribute_type) % 100  # Get a value between 0-99
    
    # Convert hex to RGB
    r = int(base_color[1:3], 16)
    g = int(base_color[3:5], 16)
    b = int(base_color[5:7], 16)
    
    # Adjust brightness based on attribute (make it lighter or darker)
    # Use the attribute index to create a consistent variation
    factor = 0.7 + (attribute_index % 30) / 100  # Between 0.7 and 0.99
    
    # Apply the factor to RGB values
    r = min(255, max(0, int(r * factor)))
    g = min(255, max(0, int(g * factor)))
    b = min(255, max(0, int(b * factor)))
    
    # Convert back to hex
    return f"#{r:02x}{g:02x}{b:02x}"


def upgrade() -> None:
    # Define tables for data insertion
    meta_element_types = table(
        'meta_element_types',
        column('id', UUID),
        column('name', sa.String),
        column('created_date', sa.DateTime),
        column('last_change', sa.DateTime),
        column('last_access', sa.DateTime),
        column('deleted', sa.Boolean)
    )
    
    meta_element_detection_attribute_types = table(
        'meta_element_detection_attribute_types',
        column('id', UUID),
        column('name', sa.String),
        column('created_date', sa.DateTime),
        column('last_change', sa.DateTime),
        column('last_access', sa.DateTime),
        column('deleted', sa.Boolean)
    )
    
    meta_roles = table(
        'meta_roles',
        column('id', UUID),
        column('meta_element_type_id', UUID),
        column('meta_element_detection_attribute_type_id', UUID),
        column('color', sa.String),
        column('created_date', sa.DateTime),
        column('last_change', sa.DateTime),
        column('last_access', sa.DateTime),
        column('deleted', sa.Boolean)
    )
    
    # Get current time for timestamps
    now = datetime.utcnow()
    
    # --- ELEMENT TYPES ---
    # Use predefined constant UUIDs for element types
    element_types_data = [
        {"id": uuid.UUID(element_types[element_type]), "name": element_type,
         "created_date": now, "last_change": now, "last_access": now, "deleted": False}
        for element_type in element_types
    ]
    
    # Store element type IDs for later reference
    element_type_ids = {et["name"]: et["id"] for et in element_types_data}
    
    # Insert element types
    op.bulk_insert(meta_element_types, element_types_data)
    print(f"Inserted {len(element_types_data)} element types")
    
    # --- ATTRIBUTE TYPES ---
    attribute_types_data = [
        {"id": uuid.uuid4(), "name": attr_name,
         "created_date": now, "last_change": now, "last_access": now, "deleted": False}
        for attr_name in attribute_types
    ]
    
    # Store attribute type IDs for later reference
    attribute_type_ids = {at["name"]: at["id"] for at in attribute_types_data}
    
    # Insert attribute types
    op.bulk_insert(meta_element_detection_attribute_types, attribute_types_data)
    print(f"Inserted {len(attribute_types_data)} attribute types")
    
    # --- META ROLES ---
    # Define element-attribute mappings
    
    volume_attributes = [
        "title", "sub_title", "author", "editor", "date_issued",
        "publisher", "part_name", "edition", 
        "place_term", "manufacture_publisher", "manufacture_place_term",
        "illustrator", "translator", "series_name", "series_number"
    ]
    
    element_attribute_mappings = {
        "page": ["page_number", "page_type"],
        "title": volume_attributes,
        "volume": volume_attributes,
        "issue": [
            "title", "sub_title", "part_number", "date_issued", "place_term", "publisher",
            "manufacture_publisher", "manufacture_place_term", 
            "redaktor"
        ],
        "chapter": ["title", "sub_title", "part_number"],
        "article": ["title", "author", "abstract", "keywords"],
        "supplement": ["title", "sub_title", "part_number", "date_issued", "author", "publisher", "place_term"]
    }
    
    # Create roles based on mappings
    roles_data = []
    for elem_type, attributes in element_attribute_mappings.items():
        for attr in attributes:
            roles_data.append({
                "id": uuid.uuid4(),
                "meta_element_type_id": element_type_ids[elem_type],
                "meta_element_detection_attribute_type_id": attribute_type_ids[attr],
                "color": generate_default_color(elem_type, attr),
                "created_date": now,
                "last_change": now,
                "last_access": now,
                "deleted": False
            })
    
    # Insert roles
    op.bulk_insert(meta_roles, roles_data)
    print(f"Inserted {len(roles_data)} meta roles")


def downgrade() -> None:
    # Delete all data from tables in reverse order
    op.execute("DELETE FROM meta_roles")
    op.execute("DELETE FROM meta_element_detection_attribute_types")
    op.execute("DELETE FROM meta_element_types")
