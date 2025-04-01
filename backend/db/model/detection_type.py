from typing import List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity


class DetectionType(Entity):
    """Type classification for detections."""

    __tablename__ = "detection_types"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="")
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)

    # Relationships - Use string references to avoid circular imports
    detections: Mapped[List["Detection"]] = relationship(
        "Detection",
        back_populates="type",
        foreign_keys="Detection.type_id",
        lazy="select",
    )
