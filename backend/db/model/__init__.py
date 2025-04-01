"""
Models package for the MetaCheck application database.

This package contains all SQLAlchemy ORM models for the database.
"""

from db.model.article import (
    Article,
    article_authors_table,
)
from db.model.base import Base, orm2dict

# Import base and utility modules
from db.model.chapter import Chapter
from db.model.collection import Collection
from db.model.detection import Detection

# Import entity models
from db.model.detection_type import DetectionType
from db.model.image import Image
from db.model.issue import (
    Issue,
    issue_publishers_table,
    issue_manufactures_table,
    issue_redaktors_table,
)
from db.model.page import Page
from db.model.page_type_detection import PageTypeDetection
from db.model.title import Title
from db.model.utils import (
    json_to_points,
    json_to_np_points,
    points_to_json,
    round_floats,
)

# Import models with association tables
from db.model.volume import (
    Volume,
    volume_publishers_table,
    volume_manufacture_publishers_table,
    volume_manufacture_place_terms_table,
    volume_authors_table,
    volume_illustrators_table,
    volume_translators_table,
    volume_editors_table,
)
