import uuid
from typing import List

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity
from metacheck.schemas.base_objects import WorkState


class Image(Entity):
    """Represents an image in the system."""

    __tablename__ = "images"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    order: Mapped[int] = mapped_column(nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    imagehash: Mapped[str] = mapped_column(index=True)
    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="images", foreign_keys=[collection_id]
    )

    detections: Mapped[List["Detection"]] = relationship(
        "Detection",
        back_populates="image",
        foreign_keys="Detection.image_id",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    # Commented relationships preserved for reference
    # pages: WriteOnlyMapped[List["Page"]] = relationship(
    #     back_populates="image", foreign_keys="Page.image_id"
    # )
