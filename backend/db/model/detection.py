import uuid
from typing import List, TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, select, text, event, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

from db.model.base import Entity
from db.model.utils import json_to_points, json_to_np_points, points_to_json

# Forward references for related models
if TYPE_CHECKING:
    from db.model.image import Image
    from db.model.meta_element_detection import MetaElementDetection
    from db.model.meta_element import MetaElement
    from db.model.meta_role import MetaRole


class Detection(Entity):
    """Represents a detection region within an image."""
    
    __tablename__ = "detections"

    # Table-level indexes using automatic naming convention
    __table_args__ = (
        # Composite index for filtering annotated detections by image
        Index(None, 'image_id', 'annotated'),
        
        # Composite index for filtering active detections by image
        Index(None, 'image_id', 'deleted'),
    )

    # Foreign keys
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Fields
    bbox: Mapped[str] = mapped_column(nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    annotated: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)
    value: Mapped[str] = mapped_column(String(300), nullable=False)

    # Relationships - Use string references to avoid circular imports
    image: Mapped["Image"] = relationship(
        "Image",
        back_populates="detections",
        foreign_keys=[image_id],
    )
    
    meta_element_detections: Mapped[List["MetaElementDetection"]] = relationship(
        "MetaElementDetection",
        back_populates="detection",
        foreign_keys="MetaElementDetection.detection_id",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Computed properties
    computed_color: Mapped[str] = column_property(
        select(text("meta_roles.color"))
        .select_from(text("meta_roles"))
        .join(text("meta_element_detections"), 
              text("meta_roles.id = meta_element_detections.meta_role_id"))
        .where(text("meta_element_detections.detection_id = detections.id"))
        .scalar_subquery()
    )
    
    computed_type: Mapped[str] = column_property(
        select(text("meta_element_types.name || '.' || meta_element_detection_attribute_types.name"))
        .select_from(text("meta_roles"))
        .join(text("meta_element_detections"), 
              text("meta_roles.id = meta_element_detections.meta_role_id"))
        .join(text("meta_element_types"),
              text("meta_roles.meta_element_type_id = meta_element_types.id"))
        .join(text("meta_element_detection_attribute_types"),
              text("meta_roles.meta_element_detection_attribute_type_id = meta_element_detection_attribute_types.id"))
        .where(text("meta_element_detections.detection_id = detections.id"))
        .scalar_subquery()
    )
    
    # Properties
    @property
    def np_bbox(self):
        return json_to_np_points(self.bbox)

    @np_bbox.setter
    def np_bbox(self, ps):
        self.bbox = points_to_json(ps)

    @property
    def n_bbox(self):
        return json_to_points(self.bbox)

    @n_bbox.setter
    def n_bbox(self, ps):
        self.bbox = points_to_json(ps)

@event.listens_for(Detection, "mapper_configured")
def _add_computed_properties(mapper, cls):
    from db.model.meta_role import MetaRole
    from db.model.meta_element_detection import MetaElementDetection
    
    cls.computed_display_type = column_property(
        select(MetaRole.computed_display_name)
        .select_from(MetaElementDetection)
        .join(MetaRole)
        .where(MetaElementDetection.detection_id == cls.id)
        .scalar_subquery()
    )