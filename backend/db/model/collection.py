import uuid
from typing import List, TYPE_CHECKING

from sqlalchemy import ForeignKey, String, func, select, event, text
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

from db.model.base import Entity, create_fk_relationship
from metacheck.schemas.base_objects import WorkState

# Forward references for related models
if TYPE_CHECKING:
    from db.model.image import Image
    from db.model.meta_element import MetaElement


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
    
    # Use string reference to properly handle circular imports
    meta_elements: Mapped[List["MetaElement"]] = relationship(
        "MetaElement",
        back_populates="collection",
        foreign_keys="MetaElement.collection_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# Add computed properties after the class definition to avoid circular references
@event.listens_for(Collection, "mapper_configured")
def _add_computed_properties(mapper, cls):
    """Add computed properties after the mapper is configured to avoid circular references."""
    # Use text() to directly specify SQL expressions, avoiding circular imports
    cls.image_count = column_property(
        select(func.count())
        .select_from(text("images"))
        .where(text("images.collection_id = collections.id"))
        .correlate_except(text("images"))
        .scalar_subquery()
    )
    
    # Query for detection count
    cls.detection_count = column_property(
        select(func.count())
        .select_from(text("detections"))
        .join(text("images"), text("detections.image_id = images.id"))
        .where(text("images.collection_id = collections.id"))
        .correlate_except(text("detections"), text("images"))
        .scalar_subquery()
    )
    
    # Query for annotated detection count
    cls.annotated_detection_count = column_property(
        select(func.count())
        .select_from(text("detections"))
        .join(text("images"), text("detections.image_id = images.id"))
        .where(text("images.collection_id = collections.id"))
        .where(text("detections.annotated = true"))
        .correlate_except(text("detections"), text("images"))
        .scalar_subquery()
    )

