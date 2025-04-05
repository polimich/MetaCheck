import uuid
from typing import List, Optional, Dict, Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.collection import Collection
from db.model.meta_element_type import MetaElementType
from db.model.base import Entity, create_fk_relationship
from metacheck.constants import META_ELEMENT_TYPE_IDS

class MetaElement(Entity):
    """Meta element with JSONB attributes for flexible property storage."""

    __tablename__ = "meta_elements"
    
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    
    collection: Mapped["Collection"] = relationship(
        "Collection", 
        foreign_keys=[collection_id],
        cascade="all"
    )

    meta_element_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_element_types.id", ondelete="CASCADE"), nullable=False
    )
    
    meta_element_type: Mapped["MetaElementType"] = relationship(
        "MetaElementType", 
        foreign_keys=[meta_element_type_id],
        cascade="all"
    )

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_elements.id", ondelete="CASCADE"), nullable=True
    )

    parent: Mapped[Optional["MetaElement"]] = relationship(
        "MetaElement", back_populates="children", remote_side="MetaElement.id"
    )
    
    children: Mapped[List["MetaElement"]] = relationship(
        "MetaElement", back_populates="parent"
    )
    
    # JSONB attribute to store type-specific properties
    attributes: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, default=dict, nullable=False, server_default="{}"
    )
    
    # Relationship to Image for page elements
    image: Mapped[Optional["Image"]] = relationship(
        "Image",
        back_populates="page_meta_element",
        foreign_keys="Image.page_meta_element_id",
        uselist=False,  # One-to-one relationship
    )
    
    @property
    def is_page(self) -> bool:
        """Check if this meta element is a page type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["page"]
    
    @property
    def is_title(self) -> bool:
        """Check if this meta element is a title type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["title"]
    
    @property
    def is_volume(self) -> bool:
        """Check if this meta element is a volume type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["volume"]
    
    @property
    def is_issue(self) -> bool:
        """Check if this meta element is an issue type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["issue"]
    
    @property
    def is_supplement(self) -> bool:
        """Check if this meta element is a supplement type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["supplement"]
    
    @property
    def is_chapter(self) -> bool:
        """Check if this meta element is a chapter type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["chapter"]
    
    @property
    def is_article(self) -> bool:
        """Check if this meta element is an article type."""
        return self.meta_element_type_id == META_ELEMENT_TYPE_IDS["article"]
    
    # Helper methods to provide type-safe access to attributes
    
    def get_attribute(self, key: str, default: Any = None) -> Any:
        """Get an attribute value with a default fallback."""
        return self.attributes.get(key, default)
    
    def set_attribute(self, key: str, value: Any) -> None:
        """Set an attribute value."""
        self.attributes[key] = value
        
    def delete_attribute(self, key: str) -> None:
        """Delete an attribute if it exists."""
        if key in self.attributes:
            del self.attributes[key]

