import uuid
from typing import List

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity, create_fk_relationship
from metacheck.schemas.base_objects import WorkState


class Collection(Entity):
    """Represents a collection of images and metadata."""

    __tablename__ = "collections"

    # Fields
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(default="", nullable=False)
    info: Mapped[str] = mapped_column(default="", nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    work_state: Mapped[WorkState] = mapped_column(
        String(50),
        default=WorkState.NEW.value,
        nullable=False
    )
    image_count: Mapped[int] = mapped_column(default=0, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Foreign keys
    preview_image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id", ondelete="SET NULL", name="fk_collections_preview_image_id"),
        index=True, nullable=True
    )

    # Display settings
    preview_image_height: Mapped[int] = mapped_column(default=337, nullable=False)
    preview_image_width: Mapped[int] = mapped_column(default=524, nullable=False)

    # Relationships - Using string references to avoid circular imports
    images: Mapped[List["Image"]] = relationship(
        "Image",
        back_populates="collection",
        foreign_keys="Image.collection_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    
    meta_elements: Mapped[List["MetaElement"]] = create_fk_relationship(
        "MetaElement", "collection_id", backref_name="collection",
        sa_relationship_kwargs={"lazy": "selectin"}
    )(lambda: MetaElement)

