import uuid
from typing import List

from sqlalchemy import ForeignKey, String, func, select
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

from db.model.meta_element import MetaElement
from db.model.collection import Collection
from db.model.detection import Detection
from db.model.base import Entity
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

    # Computed fields
    # an average of the confidence of the detections
    confidence: Mapped[float] = column_property(
        select(func.avg(Detection.confidence))
        .where(Detection.image_id == id)
        .scalar_subquery()
    )
    
    detection_count: Mapped[int] = column_property(
        select(func.count(Detection.id))
        .where(Detection.image_id == id)
        .scalar_subquery()
    )
    
    annotated_detection_count: Mapped[int] = column_property(
        select(func.count(Detection.id))
        .where(Detection.image_id == id)
        .where(Detection.annotated == True)
        .scalar_subquery()
    )

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
    
    page_meta_element: Mapped["MetaElement"] = relationship(
        "MetaElement", 
        foreign_keys=[page_meta_element_id],
        cascade="all",
        back_populates="image",
        lazy="joined"
    )    
    
    
    

