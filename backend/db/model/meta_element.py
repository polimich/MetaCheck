import uuid
from typing import List, Optional

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.collection import Collection
from db.model.meta_element_type import MetaElementType
from db.model.base import Entity, create_fk_relationship
from metacheck.constants import META_ELEMENT_TYPE_IDS
from metacheck.schemas.base_objects import PageType
# Polymorphic identity constants - you'll want to replace these with actual UUIDs
# from your meta_element_types table

class MetaElement(Entity):
    """Meta element."""

    __tablename__ = "meta_elements"
    __mapper_args__ = {
        "polymorphic_on": "meta_element_type_id",
        "with_polymorphic": "*"
    }
    
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



class PageMetaElement(MetaElement):
    """Page-specific meta element."""
    
    # No new __tablename__ - using single table inheritance
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["page"]
    }
    
    page_index: Mapped[int] = mapped_column(default=0, nullable=True)
    #page_type: Mapped[PageType] = mapped_column(default=PageType.NORMAL_PAGE, nullable=False)
    
    image: Mapped["Image"] = relationship(
        "Image",
        back_populates="page_meta_element",
        foreign_keys="Image.page_meta_element_id",
        uselist=False  # One-to-one relationship
    )
    
class TitleMetaElement(MetaElement):
    """Title-specific meta element."""
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["title"]
    }
    periodical: Mapped[bool] = mapped_column(default=False, nullable=True)
    
    
class VolumeMetaElement(MetaElement):
    """Volume-specific meta element."""
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["volume"]
    }
    periodical: Mapped[bool] = mapped_column(default=False, nullable=True, use_existing_column=True)
    
class IssueMetaElement(MetaElement):
    """Issue-specific meta element."""
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["issue"]
    }
    
    
class SupplementMetaElement(MetaElement):
    """Supplement-specific meta element."""
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["supplement"]
    }
    
    
class ChapterMetaElement(MetaElement):
    """Chapter-specific meta element."""
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["chapter"]
    }
    page_index_start: Mapped[int] = mapped_column(default=0, nullable=True)
    page_index_end: Mapped[int] = mapped_column(default=0, nullable=True)
    
    
class ArticleMetaElement(MetaElement):
    """Article-specific meta element."""    
    
    __mapper_args__ = {
        "polymorphic_identity": META_ELEMENT_TYPE_IDS["article"]
    }
    page_index_start: Mapped[int] = mapped_column(default=0, nullable=True, use_existing_column=True)
    page_index_end: Mapped[int] = mapped_column(default=0, nullable=True, use_existing_column=True)

