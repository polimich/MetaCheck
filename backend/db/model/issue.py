import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity, create_detection_association_table

# Create association tables using the helper function
issue_publishers_table = create_detection_association_table("issues", "publishers")
issue_manufactures_table = create_detection_association_table("issues", "manufactures")
issue_redaktors_table = create_detection_association_table("issues", "redaktors")


class Issue(Entity):
    """Issue metadata entity."""

    __tablename__ = "issues"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    # Detection references
    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    date_issued_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="issues", foreign_keys=[collection_id]
    )

    # Direct relationships to detections
    part_number: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[part_number_id]
    )

    date_issued: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[date_issued_id]
    )

    title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[title_id]
    )

    sub_title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[sub_title_id]
    )

    place_term: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[place_term_id]
    )

    # Many-to-many relationships
    publishers: Mapped[List["Detection"]] = relationship(
        "Detection", secondary=issue_publishers_table
    )

    manufactures: Mapped[List["Detection"]] = relationship(
        "Detection", secondary=issue_manufactures_table
    )

    redaktors: Mapped[List["Detection"]] = relationship(
        "Detection", secondary=issue_redaktors_table
    )


# Import at the end to avoid circular imports
from db.model.collection import Collection
from db.model.detection import Detection
