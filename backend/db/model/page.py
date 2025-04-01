import uuid
from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity


class Page(Entity):
    """Page metadata entity."""

    __tablename__ = "pages"

    # Foreign keys
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    batch_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    page_index: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Detection references
    page_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    page_type_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("page_type_detections.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    # Relationships - Use string references to avoid circular imports
    image: Mapped["Image"] = relationship("Image", foreign_keys=[image_id])

    page_number: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[page_number_id]
    )

    page_type: Mapped[Optional["PageTypeDetection"]] = relationship(
        "PageTypeDetection", foreign_keys=[page_type_id]
    )
