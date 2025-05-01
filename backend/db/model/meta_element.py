import uuid
from typing import List, Optional, Dict, Any, TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Avoid circular imports using TYPE_CHECKING
if TYPE_CHECKING:
    from db.model.collection import Collection
    from db.model.image import Image
    from db.model.meta_element_detection import MetaElementDetection

from db.model.meta_element_type import MetaElementType
from db.model.base import Entity, create_fk_relationship
from metacheck.constants import META_ELEMENT_TYPE_IDS

class MetaElement(Entity):
    """Meta element with JSONB attributes for flexible property storage."""

    __tablename__ = "meta_elements"
    
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    
    # Use string reference to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", 
        foreign_keys=[collection_id],
        back_populates="meta_elements",
        lazy="selectin"
    )

    meta_element_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_element_types.id", ondelete="CASCADE"), nullable=False
    )
    
    meta_element_type: Mapped["MetaElementType"] = relationship(
        "MetaElementType", 
        foreign_keys=[meta_element_type_id],
        cascade="all",
        lazy="selectin"
    )

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_elements.id", ondelete="CASCADE"), nullable=True
    )

    # For self-referential relationships, use selectin for the parent (single item)
    # but joined for children to avoid recursive loading issues
    parent: Mapped[Optional["MetaElement"]] = relationship(
        "MetaElement", 
        back_populates="children", 
        remote_side="MetaElement.id",
        lazy="selectin"
    )
    
    children: Mapped[List["MetaElement"]] = relationship(
        "MetaElement", 
        back_populates="parent",
        lazy="joined"  # Use joined loading for children to prevent recursion issues
    )
    
    images: Mapped[List["Image"]] = relationship(
        "Image",
        back_populates="parent_meta_element",
        foreign_keys="Image.parent_meta_element_id",
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    
    # JSONB attribute to store type-specific properties
    attributes: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, server_default="{}"
    )
    
    meta_element_detections: Mapped[List["MetaElementDetection"]] = relationship(
        "MetaElementDetection",
        back_populates="meta_element",
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    
    @property
    def is_title(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["title"]
    
    @property
    def is_volume(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["volume"]
    
    @property
    def is_issue(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["issue"]
    
    @property
    def is_supplement(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["supplement"]
    
    @property
    def is_chapter(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["chapter"]
    
    @property
    def is_article(self) -> bool:
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["article"]
    
    # Helper methods to provide type-safe access to attributes
    
    def get_attribute(self, key: str, default: Any = None) -> Any:
        return self.attributes.get(key, default)
    
    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value
        
    def delete_attribute(self, key: str) -> None:
        if key in self.attributes:
            del self.attributes[key]

