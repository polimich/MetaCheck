import uuid
from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity


class Chapter(Entity):
    """Chapter metadata entity."""

    __tablename__ = "chapters"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    page_index_start: Mapped[int] = mapped_column(nullable=False)
    page_index_end: Mapped[int] = mapped_column(nullable=False)

    # Detection references
    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="chapters", foreign_keys=[collection_id]
    )

    title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[title_id]
    )

    sub_title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[sub_title_id]
    )

    part_number: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[part_number_id]
    )
