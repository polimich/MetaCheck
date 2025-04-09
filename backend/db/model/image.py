import uuid
from typing import List, cast, TYPE_CHECKING

from sqlalchemy import ForeignKey, String, func, select, event, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

# Use TYPE_CHECKING to avoid circular imports
if TYPE_CHECKING:
    from db.model.meta_element import MetaElement
    from db.model.collection import Collection

from db.model.detection import Detection
from db.model.base import Entity, create_fk_relationship
from metacheck.schemas.base_objects import WorkState


class Image(Entity):
    """Represents an image in the system."""

    __tablename__ = "images"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE", name="fk_images_collection_id"), 
        index=True, nullable=False
    )
    
    page_meta_element_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_elements.id", ondelete="CASCADE", name="fk_images_page_meta_element_id"),
        index=True, nullable=False
    )
    
    # Fields
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)
    imagehash: Mapped[str] = mapped_column(index=True)
    work_state: Mapped[WorkState] = mapped_column(
        String(50), 
        default=WorkState.NEW.value,
        nullable=False
    )

    # Computed fields are defined below the class to avoid circular references

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", 
        back_populates="images", 
        foreign_keys=[collection_id],
        lazy="selectin"
    )

    detections: Mapped[List["Detection"]] = relationship(
        "Detection",
        back_populates="image",
        foreign_keys="Detection.image_id",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    
    page_meta_element: Mapped["MetaElement"] = relationship(
        "MetaElement", 
        foreign_keys=[page_meta_element_id],
        cascade="all",
        back_populates="image",
        lazy="selectin"
    )


# Add computed properties after the class definition to avoid circular references
@event.listens_for(Image, "mapper_configured")
def _add_computed_properties(mapper, cls):
    """Add computed properties after the mapper is configured to avoid circular references."""
    cls.confidence = column_property(
        select(func.avg(Detection.confidence))
        .where(Detection.image_id == cls.id)
        .scalar_subquery()
    )
    
    cls.detection_count = column_property(
        select(func.count(Detection.id))
        .where(Detection.image_id == cls.id)
        .scalar_subquery()
    )
    
    cls.annotated_detection_count = column_property(
        select(func.count(Detection.id))
        .where(Detection.image_id == cls.id)
        .where(Detection.annotated == True)
        .scalar_subquery()
    )
    
    # Fix: access pageIndex from the attributes JSONB field
    from db.model.meta_element import MetaElement
    
    cls.order = column_property(
        select(func.cast(MetaElement.attributes['pageIndex'], String))
        .where(MetaElement.id == cls.page_meta_element_id)
        .scalar_subquery()  
    )
    

