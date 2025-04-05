import uuid
from typing import List

from sqlalchemy import ForeignKey, String, select
from sqlalchemy.orm import Mapped, mapped_column, column_property, relationship
from sqlalchemy.sql import func

from db.model.meta_element_detection_attribute_type import MetaElementDetectionAttributeType
from db.model.meta_element_type import MetaElementType
from db.model.base import Entity, create_fk_relationship


class MetaRole(Entity):
    """Meta role."""

    __tablename__ = "meta_roles"

    meta_element_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_element_types.id", ondelete="CASCADE"), nullable=False
    )

    meta_element_type: Mapped["MetaElementType"] = relationship(
        "MetaElementType", 
        foreign_keys=[meta_element_type_id],
        cascade="all",
        lazy="selectin"
    )
    
    meta_element_detection_attribute_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_element_detection_attribute_types.id", ondelete="CASCADE"), nullable=False
    )

    meta_element_detection_attribute_type: Mapped["MetaElementDetectionAttributeType"] = relationship(
        "MetaElementDetectionAttributeType", 
        foreign_keys=[meta_element_detection_attribute_type_id],
        cascade="all",
        lazy="selectin"
    )
    
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    
    computed_name: Mapped[str] = column_property(
        select(MetaElementType.name + "." + MetaElementDetectionAttributeType.name)
        .where(MetaElementType.id == meta_element_type_id)
        .where(MetaElementDetectionAttributeType.id == meta_element_detection_attribute_type_id)
        .scalar_subquery()
    )
    
    computed_display_name: Mapped[str] = column_property(
        select(MetaElementType.display_name + " " + MetaElementDetectionAttributeType.display_name)
        .where(MetaElementType.id == meta_element_type_id)
        .where(MetaElementDetectionAttributeType.id == meta_element_detection_attribute_type_id)
        .scalar_subquery()
    )
    
    
    
    