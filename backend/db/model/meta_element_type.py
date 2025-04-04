from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, column_property
from sqlalchemy.sql import func
from typing import List

from db.model.base import Entity


class MetaElementType(Entity):
    """Type of meta element."""

    __tablename__ = "meta_element_types"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    display_name: Mapped[str] = column_property(
        func.regexp_replace(
            func.initcap(
                func.regexp_replace(name, '_', ' ', 'g')
            ),
            '\\s+', ' ', 'g'
        )
    )
    