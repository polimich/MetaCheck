import uuid
from typing import List

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity
from metacheck.schemas.base_objects import WorkState


class Collection(Entity):
    """Represents a collection of images and metadata."""

    __tablename__ = "collections"

    # Fields
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(default="", nullable=False)
    info: Mapped[str] = mapped_column(default="", nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)
    image_count: Mapped[int] = mapped_column(default=0, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Foreign keys
    preview_image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id", ondelete="SET NULL"), index=True, nullable=True
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
    )

    titles: Mapped[List["Title"]] = relationship(
        "Title",
        back_populates="collection",
        foreign_keys="Title.collection_id",
        cascade="all, delete-orphan",
    )

    volumes: Mapped[List["Volume"]] = relationship(
        "Volume",
        back_populates="collection",
        foreign_keys="Volume.collection_id",
        cascade="all, delete-orphan",
    )

    issues: Mapped[List["Issue"]] = relationship(
        "Issue",
        back_populates="collection",
        foreign_keys="Issue.collection_id",
        cascade="all, delete-orphan",
    )

    chapters: Mapped[List["Chapter"]] = relationship(
        "Chapter",
        back_populates="collection",
        foreign_keys="Chapter.collection_id",
        cascade="all, delete-orphan",
    )

    articles: Mapped[List["Article"]] = relationship(
        "Article",
        back_populates="collection",
        foreign_keys="Article.collection_id",
        cascade="all, delete-orphan",
    )
