"""seed_meta_element_samples

Revision ID: a20240405
Revises: 747d2577521d
Create Date: 2025-04-05 12:00:00.000000

"""
from typing import Union, Sequence
from datetime import datetime
import uuid
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, select
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'a20240405'
down_revision: Union[str, None] = '747d2577521d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Constants - Using the same element type IDs as defined in metacheck/constants.py
META_ELEMENT_TYPE_IDS = {
    "page": "e1000000-0000-4000-a000-000000000001",
    "title": "e1000000-0000-4000-a000-000000000002",
    "volume": "e1000000-0000-4000-a000-000000000003",
    "issue": "e1000000-0000-4000-a000-000000000004",
    "supplement": "e1000000-0000-4000-a000-000000000005",
    "chapter": "e1000000-0000-4000-a000-000000000006",
    "article": "e1000000-0000-4000-a000-000000000007"
}

def generate_uuid():
    """Generate a UUID for sample data."""
    return str(uuid.uuid4())

def upgrade() -> None:
    # Define meta_elements table
    meta_elements = table(
        'meta_elements',
        column('id', UUID(as_uuid=True)),
        column('created_date', sa.DateTime),
        column('last_change', sa.DateTime),
        column('last_access', sa.DateTime),
        column('deleted', sa.Boolean),
        column('collection_id', UUID(as_uuid=True)),
        column('meta_element_type_id', UUID(as_uuid=True)),
        column('parent_id', UUID(as_uuid=True)),
        column('attributes', JSONB)
    )
    
    # Define collections table to fetch a collection ID
    collections = table(
        'collections',
        column('id', UUID(as_uuid=True))
    )
    
    # Get current timestamp for all records
    now = datetime.utcnow()
    
    # Create sample UUIDs for our elements
    title_id = uuid.uuid4()
    volume_id = uuid.uuid4()
    issue_id = uuid.uuid4()
    page_id = uuid.uuid4()
    supplement_id = uuid.uuid4()
    chapter_id = uuid.uuid4()
    article_id = uuid.uuid4()
    
    # First, check if any collections exist to use as the collection_id
    connection = op.get_bind()
    result = connection.execute(select(collections.c.id).limit(1))
    collection_id = None
    for row in result:
        collection_id = row[0]
    
    # If no collections found, create a sample collection
    if collection_id is None:
        collection_id = uuid.uuid4()
        op.execute(
            f"""
            INSERT INTO collections (id, name, description, info, work_state, 
                                    image_count, detection_count, annotated_detection_count,
                                    preview_image_height, preview_image_width,
                                    created_date, last_change, last_access, deleted)
            VALUES ('{collection_id}', 'Sample Collection', 'Sample collection for testing', '',
                    'new', 0, 0, 0, 337, 524, '{now}', '{now}', '{now}', false)
            """
        )
        print(f"Created sample collection with ID: {collection_id}")
    
    # Create sample data for each MetaElement type
    sample_elements = [
        # Title element (top level)
        {
            "id": title_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["title"]),
            "parent_id": None,
            "attributes": {
                "periodical": True,
                "title": ["Example Journal Title", 0.95, generate_uuid()],
                "subTitle": ["Academic Publishing", 0.9, generate_uuid()],
                "dateIssued": ["2020-2023", 0.8, generate_uuid()],
                "partNumber": ["Volumes 1-3", 0.85, generate_uuid()]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Volume element (child of title)
        {
            "id": volume_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["volume"]),
            "parent_id": title_id,
            "attributes": {
                "periodical": True,
                "partNumber": ["Volume 2", 0.92, generate_uuid()],
                "partName": ["Special Edition", 0.88, generate_uuid()],
                "dateIssued": ["2022", 0.95, generate_uuid()],
                "title": ["Annual Research Compendium", 0.9, generate_uuid()],
                "subTitle": ["Advances in Machine Learning", 0.85, generate_uuid()],
                "edition": ["2nd Edition", 0.93, generate_uuid()],
                "publisher": [
                    ["Academic Press", 0.94, generate_uuid()]
                ],
                "placeTerm": [
                    ["New York", 0.91, generate_uuid()]
                ],
                "manufacturePublisher": [
                    ["University Print", 0.87, generate_uuid()]
                ],
                "manufacturePlaceTerm": [
                    ["Boston", 0.86, generate_uuid()]
                ],
                "author": [
                    ["John Smith", 0.95, generate_uuid()],
                    ["Jane Doe", 0.93, generate_uuid()]
                ],
                "illustrator": [
                    ["Alex Brown", 0.89, generate_uuid()]
                ],
                "translator": [
                    ["Maria Garcia", 0.92, generate_uuid()]
                ],
                "editor": [
                    ["Robert Johnson", 0.96, generate_uuid()]
                ],
                "seriesName": [
                    ["Research Series", 0.9, generate_uuid()]
                ],
                "seriesNumber": [
                    ["Series #5", 0.88, generate_uuid()]
                ]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Issue element (child of volume)
        {
            "id": issue_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["issue"]),
            "parent_id": volume_id,
            "attributes": {
                "partNumber": ["Issue 3", 0.94, generate_uuid()],
                "dateIssued": ["September 2022", 0.93, generate_uuid()],
                "title": ["Quarterly Update", 0.92, generate_uuid()],
                "subTitle": ["Focus on Neural Networks", 0.9, generate_uuid()],
                "placeTerm": ["London", 0.89, generate_uuid()],
                "publisher": [
                    ["Global Science", 0.91, generate_uuid()]
                ],
                "manufacturePublisher": [
                    ["Premier Printing", 0.88, generate_uuid()]
                ],
                "manufacturePlaceTerm": [
                    ["Edinburgh", 0.87, generate_uuid()]
                ],
                "redaktor": [
                    ["Susan Williams", 0.95, generate_uuid()],
                    ["Thomas Miller", 0.93, generate_uuid()]
                ]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Page element (child of issue)
        {
            "id": page_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["page"]),
            "parent_id": issue_id,
            "attributes": {
                "pageIndex": 42,
                "pageNumber": ["42", 0.98, generate_uuid()],
                "pageType": ["NormalPage", 0.96]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Supplement element (child of issue)
        {
            "id": supplement_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["supplement"]),
            "parent_id": issue_id,
            "attributes": {
                "title": ["Data Appendix", 0.93, generate_uuid()],
                "subTitle": ["Supplementary Materials", 0.9, generate_uuid()],
                "partNumber": ["Supplement A", 0.92, generate_uuid()],
                "dateIssued": ["October 2022", 0.91, generate_uuid()],
                "author": [
                    ["Research Team", 0.94, generate_uuid()]
                ],
                "publisher": [
                    ["Data Science Publishing", 0.89, generate_uuid()]
                ],
                "placeTerm": ["San Francisco", 0.88, generate_uuid()]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Chapter element (child of volume)
        {
            "id": chapter_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["chapter"]),
            "parent_id": volume_id,
            "attributes": {
                "pageIndexStart": 10,
                "pageIndexEnd": 25,
                "title": ["Introduction to Deep Learning", 0.95, generate_uuid()],
                "subTitle": ["Fundamentals and Applications", 0.92, generate_uuid()],
                "partNumber": ["Chapter 2", 0.94, generate_uuid()]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        },
        
        # Article element (child of issue)
        {
            "id": article_id,
            "collection_id": collection_id,
            "meta_element_type_id": uuid.UUID(META_ELEMENT_TYPE_IDS["article"]),
            "parent_id": issue_id,
            "attributes": {
                "pageIndexStart": 30,
                "pageIndexEnd": 45,
                "title": ["Advances in Natural Language Processing", 0.96, generate_uuid()],
                "author": [
                    ["Dr. Emily Chen", 0.95, generate_uuid()],
                    ["Prof. Michael Johnson", 0.93, generate_uuid()]
                ],
                "abstract": ["This article explores recent developments in NLP...", 0.91, generate_uuid()],
                "keywords": ["NLP, machine learning, transformers", 0.89, generate_uuid()]
            },
            "created_date": now,
            "last_change": now,
            "last_access": now,
            "deleted": False
        }
    ]
    
    # Insert the sample elements
    for element in sample_elements:
        # Convert attributes to JSON string for insertion
        attributes_json = json.dumps(element["attributes"])
        element["attributes"] = attributes_json
    
    # Bulk insert all elements
    op.bulk_insert(meta_elements, sample_elements)
    print(f"Inserted {len(sample_elements)} sample meta elements")

def downgrade() -> None:
    # Define the meta_elements table
    meta_elements = table(
        'meta_elements',
        column('id', UUID(as_uuid=True))
    )
    
    # Delete the sample meta elements by their IDs
    # Note: In a real migration, you might want to be more specific about which records to delete
    op.execute(
        """
        DELETE FROM meta_elements 
        WHERE id IN (
            SELECT id FROM meta_elements 
            ORDER BY created_date DESC 
            LIMIT 7
        )
        """
    )
    print("Removed sample meta elements") 