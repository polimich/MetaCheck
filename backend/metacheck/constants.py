"""
Constants for the MetaCheck application.
"""
import uuid

# Meta Element Type UUIDs
# These must match the UUIDs used in the alembic migration '67208458c241_seed_meta_initial_data.py'
META_ELEMENT_TYPE_IDS = {
    "page": uuid.UUID("e1000000-0000-4000-a000-000000000001"),
    "title": uuid.UUID("e1000000-0000-4000-a000-000000000002"),
    "volume": uuid.UUID("e1000000-0000-4000-a000-000000000003"),
    "issue": uuid.UUID("e1000000-0000-4000-a000-000000000004"),
    "supplement": uuid.UUID("e1000000-0000-4000-a000-000000000005"),
    "chapter": uuid.UUID("e1000000-0000-4000-a000-000000000006"),
    "article": uuid.UUID("e1000000-0000-4000-a000-000000000007")
} 