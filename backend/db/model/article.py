import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, WriteOnlyMapped

from db.model.base import Entity, create_detection_association_table

# Create association table using the helper function
article_authors_table = create_detection_association_table("articles", "authors")


class Article(Entity):
    """Article metadata entity."""

    __tablename__ = "articles"

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

    abstract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    keywords_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="articles", foreign_keys=[collection_id]
    )

    title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[title_id]
    )

    abstract: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[abstract_id]
    )

    keywords: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[keywords_id]
    )

    # Many-to-many relationships
    authors: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=article_authors_table
    )
