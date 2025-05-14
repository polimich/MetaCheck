
"""
@author: Michael Polívka xpoliv07


Meta element detection attribute type model.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, column_property
from sqlalchemy.sql import func

from db.model.base import Entity


class MetaElementDetectionAttributeType(Entity):
    """Type of meta element detection attribute."""

    __tablename__ = "meta_element_detection_attribute_types"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    display_name: Mapped[str] = column_property(
        func.regexp_replace(
            func.initcap(
                func.regexp_replace(name, '_', ' ', 'g')
            ),
            '\\s+', ' ', 'g'
        )
    )