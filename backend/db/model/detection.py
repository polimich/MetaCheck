import uuid
from typing import List

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity
from db.model.utils import json_to_points, json_to_np_points, points_to_json


class Detection(Entity):
    """A detection found in an image."""

    __tablename__ = "detections"

    # Foreign keys
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    bbox: Mapped[str] = mapped_column(nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    annotated: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)
    value: Mapped[str] = mapped_column(String(300), nullable=False)

    # Relationships - Use string references to avoid circular imports
    image: Mapped["Image"] = relationship(
        "Image",
        back_populates="detections",
        foreign_keys=[image_id],
    )

    # Properties
    @property
    def np_bbox(self):
        return json_to_np_points(self.bbox)

    @np_bbox.setter
    def np_bbox(self, ps):
        self.bbox = points_to_json(ps)

    @property
    def n_bbox(self):
        return json_to_points(self.bbox)

    @n_bbox.setter
    def n_bbox(self, ps):
        self.bbox = points_to_json(ps)
