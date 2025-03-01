import json
import math
import uuid
from datetime import datetime
from typing import List, Optional

import numpy as np
from sqlalchemy import ForeignKey, String, Column, Table
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    DeclarativeBase,
    relationship,
    WriteOnlyMapped,
)

from metacheck.schemas.base_objects import WorkState, PageType

# converts ORM row object to dict
orm2dict = lambda r: {c.name: getattr(r, c.name) for c in r.__table__.columns}


# converts CORE row object to dict
row2dict = lambda r: dict(r._mapping)


class Base(DeclarativeBase):
    pass


class MyTableMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_date: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, index=True, nullable=False
    )
    last_change: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, index=True, nullable=False
    )
    last_access: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, index=True, nullable=False
    )
    deleted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)


class DetectionType(MyTableMixin, Base):
    __tablename__ = "detection_types"
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="")
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    detections: Mapped[List["Detection"]] = relationship(
        back_populates="type", foreign_keys="Detection.type_id"
    )


class Detection(MyTableMixin, Base):
    __tablename__ = "detections"
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id"), index=True, nullable=False
    )
    image: Mapped["Image"] = relationship(
        back_populates="detections", foreign_keys="Detection.image_id"
    )

    type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("detection_types.id"), nullable=False
    )
    type: Mapped["DetectionType"] = relationship(
        back_populates="detections", foreign_keys="Detection.type_id"
    )
    bbox: Mapped[str] = mapped_column(nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=True)
    annotated: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)

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


class Image(MyTableMixin, Base):
    __tablename__ = "images"
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        back_populates="images", foreign_keys="Image.collection_id"
    )
    detections: Mapped[List["Detection"]] = relationship(
        back_populates="image", foreign_keys="Detection.image_id", lazy="joined"
    )
    # pages: WriteOnlyMapped[List["Page"]] = relationship(
    #     back_populates="image", foreign_keys="Page.image_id"
    # )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    order: Mapped[int] = mapped_column(nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)

    confidence: Mapped[float] = mapped_column(nullable=True)
    imagehash: Mapped[str] = mapped_column(index=True)
    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)


class Collection(MyTableMixin, Base):
    __tablename__ = "collections"
    images: Mapped[List["Image"]] = relationship(
        back_populates="collection", foreign_keys="Image.collection_id"
    )

    titles: Mapped[List["Title"]] = relationship(
        back_populates="collection", foreign_keys="Title.collection_id"
    )
    volumes: Mapped[List["Volume"]] = relationship(
        back_populates="collection", foreign_keys="Volume.collection_id"
    )
    issues: Mapped[List["Issue"]] = relationship(
        back_populates="collection", foreign_keys="Issue.collection_id"
    )
    chapters: Mapped[List["Chapter"]] = relationship(
        back_populates="collection", foreign_keys="Chapter.collection_id"
    )
    articles: Mapped[List["Article"]] = relationship(
        back_populates="collection", foreign_keys="Article.collection_id"
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(default="", nullable=False)
    info: Mapped[str] = mapped_column(default="", nullable=False)

    confidence: Mapped[float] = mapped_column(nullable=True)

    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)

    image_count: Mapped[int] = mapped_column(default=0, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    preview_image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id"), index=True, nullable=True
    )

    preview_image_height: Mapped[int] = mapped_column(default=337, nullable=False)
    preview_image_width: Mapped[int] = mapped_column(default=524, nullable=False)


class PageTypeDetection(MyTableMixin, Base):
    __tablename__ = "page_type_detections"

    confidence: Mapped[float] = mapped_column(nullable=True)
    value: Mapped[PageType] = mapped_column(nullable=False)


class Title(MyTableMixin, Base):
    __tablename__ = "titles"
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        back_populates="titles", foreign_keys="Title.collection_id"
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["Detection"]] = relationship(foreign_keys="Title.title_id")
    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Title.sub_title_id"
    )


volume_publishers_table = Table(
    "volume_publishers_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

volume_manufacture_publishers_table = Table(
    "volume_manufacture_publishers_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

volume_manufacture_place_terms_table = Table(
    "volume_manufacture_place_terms_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

volume_authors_table = Table(
    "volume_authors_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

volume_illustrators_table = Table(
    "volume_illustrators_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

volume_translators_table = Table(
    "volume_translators_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)


volume_editors_table = Table(
    "volume_editors_table",
    Base.metadata,
    Column("volume_id", ForeignKey("volumes.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)


class Volume(MyTableMixin, Base):
    __tablename__ = "volumes"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        back_populates="volumes", foreign_keys="Volume.collection_id"
    )
    periodical: Mapped[bool] = mapped_column(nullable=False, default=False)

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True)

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.part_number_id"
    )

    part_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    part_name: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.part_name_id"
    )

    date_issued_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    date_issued: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.date_issued_id"
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["Detection"]] = relationship(foreign_keys="Volume.title_id")

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.sub_title_id"
    )

    edition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    edition: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.edition_id"
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    place_term: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.place_term_id"
    )

    publishers: WriteOnlyMapped[List[Detection]] = relationship(
        secondary=volume_publishers_table
    )

    manufacture_publishers: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_manufacture_publishers_table,
    )

    manufacture_place_terms: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_manufacture_place_terms_table
    )

    authors: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_authors_table
    )

    illustrators: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_illustrators_table
    )

    translators: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_translators_table
    )

    editors: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=volume_editors_table
    )

    series_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    series_name: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.series_name_id"
    )

    series_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    series_number: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Volume.series_number_id"
    )


issue_publishers_table = Table(
    "issue_publishers_table",
    Base.metadata,
    Column("issue_id", ForeignKey("issues.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

issue_manufactures_table = Table(
    "issue_manufactures_table",
    Base.metadata,
    Column("issue_id", ForeignKey("issues.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)

issue_redaktors_table = Table(
    "issue_redaktors_table",
    Base.metadata,
    Column("issue_id", ForeignKey("issues.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)


class Issue(MyTableMixin, Base):
    __tablename__ = "issues"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(foreign_keys="Issue.collection_id")

    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Issue.part_number_id"
    )

    date_issued_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    date_issued: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Issue.date_issued_id"
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["Detection"]] = relationship(foreign_keys="Issue.title_id")

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Issue.sub_title_id"
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    place_term: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Issue.place_term_id"
    )

    publishers: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=issue_publishers_table
    )

    manufactures: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=issue_manufactures_table
    )

    redaktors: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=issue_redaktors_table
    )


class Page(MyTableMixin, Base):
    __tablename__ = "pages"

    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id"), index=True, nullable=False
    )
    image: Mapped["Image"] = relationship(foreign_keys="Page.image_id")

    batch_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    page_index: Mapped[Optional[int]] = mapped_column(nullable=True)

    page_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    page_number: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Page.page_number_id"
    )

    page_type_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("page_type_detections.id"), index=True, nullable=True
    )
    page_type: Mapped[Optional["PageTypeDetection"]] = relationship(
        foreign_keys="Page.page_type_id"
    )


class Chapter(MyTableMixin, Base):
    __tablename__ = "chapters"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        foreign_keys="Chapter.collection_id"
    )
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    page_index_start: Mapped[int] = mapped_column(nullable=False)

    page_index_end: Mapped[int] = mapped_column(nullable=False)

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["Detection"]] = relationship(foreign_keys="Chapter.title_id")

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Chapter.sub_title_id"
    )

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Chapter.part_number_id"
    )


article_authors_table = Table(
    "article_authors_table",
    Base.metadata,
    Column("article_id", ForeignKey("articles.id"), index=True),
    Column("detection_id", ForeignKey("detections.id"), index=True),
)


class Article(MyTableMixin, Base):
    __tablename__ = "articles"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        foreign_keys="Article.collection_id"
    )
    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    page_index_start: Mapped[int] = mapped_column(nullable=False)

    page_index_end: Mapped[int] = mapped_column(nullable=False)

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["Detection"]] = relationship(foreign_keys="Article.title_id")

    authors: WriteOnlyMapped[List["Detection"]] = relationship(
        secondary=article_authors_table
    )

    abstract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    abstract: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Article.abstract_id"
    )

    keywords_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id"), index=True, nullable=True
    )
    keywords: Mapped[Optional["Detection"]] = relationship(
        foreign_keys="Article.keywords_id"
    )


def json_to_points(json_points, precision=1):
    return round_floats(json.loads(json_points), precision)


def json_to_np_points(str_points, precision=1, np=None):
    return np.asarray(json_to_points(str_points, precision))


def points_to_json(points, precision=1):
    return json.dumps(round_floats(points, precision))


def round_floats(obj, precision=1):
    if isinstance(obj, float):
        if math.isnan(obj):
            obj = 0
        r = round(obj, precision)
        int_r = int(r)
        if r == int_r:
            return int_r
        else:
            return r
    elif isinstance(obj, dict):
        return dict((k, round_floats(v, precision)) for k, v in obj.items())
    elif isinstance(obj, (list, tuple)):
        return list(map(lambda o: round_floats(o, precision), obj))
    if isinstance(obj, np.ndarray):
        return round_floats(obj.tolist(), precision)
    return obj
