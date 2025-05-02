import uuid
from typing import List, cast, TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, func, select, event, Column, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

# Use TYPE_CHECKING to avoid circular imports
if TYPE_CHECKING:
    from db.model.meta_element import MetaElement
    from db.model.collection import Collection
    from db.model.detection import Detection

from db.model.base import Entity
from metacheck.schemas.base_objects.enums import WorkState, PageType


class Image(Entity):
    """Represents an image in the system with its metadata."""
    
    __tablename__ = "images"

    # Table-level indexes using automatic naming convention
    __table_args__ = (
        # Composite index for fast image lookup by collection and hash
        Index(None, 'collection_id', 'imagehash'),
        
        # Composite index for finding images by meta element with deleted filter
        Index(None, 'parent_meta_element_id', 'deleted'),
        
        # Composite index for collection-based filtering with deleted filter
        Index(None, 'collection_id', 'deleted'),
    )

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE", name="fk_images_collection_id"), 
        index=True, nullable=False
    )
    parent_meta_element_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_elements.id", ondelete="CASCADE", name="fk_images_page_meta_element_id"),
        index=True, nullable=False
    )
    
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)
    imagehash: Mapped[str] = mapped_column(index=True)
    work_state: Mapped[WorkState] = mapped_column(
        String(50), 
        default=WorkState.NEW.value,
        nullable=False
    )
    order: Mapped[int] = mapped_column(nullable=False)
    page_type: Mapped[Optional[PageType]] = mapped_column(
        String(50),
        nullable=True
    )
    page_type_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    page_index: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    page_index_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    page_index_bbox: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    
    collection: Mapped["Collection"] = relationship(
        "Collection", 
        back_populates="images", 
        foreign_keys=[collection_id],
        lazy="selectin"
    )
    
    parent_meta_element: Mapped["MetaElement"] = relationship(
        "MetaElement", 
        foreign_keys=[parent_meta_element_id],
        cascade="all",
        back_populates="images",
        lazy="selectin"
    )
    
    detections: Mapped[List["Detection"]] = relationship(
        "Detection",
        back_populates="image",
        foreign_keys="Detection.image_id",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


# Add computed properties after the class definition to avoid circular references
@event.listens_for(Image, "mapper_configured")
def _add_computed_properties(mapper, cls):
    from db.model.detection import Detection
    
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
    

