from sqlalchemy.orm import Mapped, mapped_column

from db.model.base import Entity
from metacheck.schemas.base_objects import PageType


class PageTypeDetection(Entity):
    """Detection of page type."""

    __tablename__ = "page_type_detections"

    confidence: Mapped[float] = mapped_column(nullable=True)
    value: Mapped[PageType] = mapped_column(nullable=False)
