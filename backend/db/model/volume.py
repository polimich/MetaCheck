import uuid
from typing import List, Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, WriteOnlyMapped

from db.model.base import Entity, create_detection_association_table

# Create association tables using the helper function
volume_publishers_table = create_detection_association_table("volumes", "publishers")
volume_manufacture_publishers_table = create_detection_association_table(
    "volumes", "manufacture_publishers"
)
volume_manufacture_place_terms_table = create_detection_association_table(
    "volumes", "manufacture_place_terms"
)
volume_authors_table = create_detection_association_table("volumes", "authors")
volume_illustrators_table = create_detection_association_table(
    "volumes", "illustrators"
)
volume_translators_table = create_detection_association_table("volumes", "translators")
volume_editors_table = create_detection_association_table("volumes", "editors")


class Volume(Entity):
    """Volume metadata entity."""

    __tablename__ = "volumes"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    periodical: Mapped[bool] = mapped_column(nullable=False, default=False)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True)

    # Detection references
    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    part_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
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

    edition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    series_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    series_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="volumes", foreign_keys=[collection_id]
    )

    # Direct relationships to detections
    part_number: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[part_number_id]
    )

    part_name: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[part_name_id]
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

    edition: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[edition_id]
    )

    place_term: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[place_term_id]
    )

    series_name: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[series_name_id]
    )

    series_number: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[series_number_id]
    )

    # Many-to-many relationships
    publishers: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_publishers_table
    )

    manufacture_publishers: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection",
        secondary=volume_manufacture_publishers_table,
    )

    manufacture_place_terms: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_manufacture_place_terms_table
    )

    authors: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_authors_table
    )

    illustrators: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_illustrators_table
    )

    translators: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_translators_table
    )

    editors: WriteOnlyMapped[List["Detection"]] = relationship(
        "Detection", secondary=volume_editors_table
    )
