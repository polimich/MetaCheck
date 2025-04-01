from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from metacheck.schemas.base_objects.base_entity import BaseEntity


class ArticleNew(BaseModel):
    """Schema for creating a new article."""

    id: UUID
    parent_id: UUID

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    authors: List["Detection"] = []
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None


class Article(ArticleNew, BaseEntity):
    """Schema for an article."""

    title: Optional["Detection"] = None
    abstract: Optional["Detection"] = None
    keywords: Optional["Detection"] = None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class ArticleUpdate(BaseModel):
    """Schema for updating an article."""

    id: UUID
    parent_id: Optional[UUID] = None

    page_index_start: Optional[int] = None
    page_index_end: Optional[int] = None

    title_id: Optional[UUID] = None
    authors: Optional[List["Detection"]] = None
    abstract_id: Optional[UUID] = None
    keywords_id: Optional[UUID] = None

    last_access: Optional[datetime] = None
    deleted: Optional[bool] = None


# Import at the end to avoid circular references
from metacheck.schemas.base_objects.detection import Detection