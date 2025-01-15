import json
import math
import uuid
from datetime import datetime
from typing import List, Optional

import numpy as np
from sqlalchemy import ForeignKey, String
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


class Detection(MyTableMixin, Base):
    __tablename__ = "detections"
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("images.id"), index=True, nullable=False
    )
    image: Mapped["Image"] = relationship(viewonly=True)

    type: Mapped[str] = mapped_column(nullable=False)
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
    detections: WriteOnlyMapped[List["Detection"]] = relationship(
        back_populates="image", foreign_keys="Detection.image_id"
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
    images: WriteOnlyMapped[List["Image"]] = relationship(
        back_populates="collection", foreign_keys="Image.collection_id"
    )
    titles: WriteOnlyMapped[List["Title"]] = relationship(
        back_populates="collection", foreign_keys="Title.collection_id"
    )
    volumes: WriteOnlyMapped[List["Volume"]] = relationship(
        back_populates="collection", foreign_keys="Volume.collection_id"
    )
    issues: WriteOnlyMapped[List["Issue"]] = relationship(
        back_populates="collection", foreign_keys="Issue.collection_id"
    )
    chapters: WriteOnlyMapped[List["Chapter"]] = relationship(
        back_populates="collection", foreign_keys="Chapter.collection_id"
    )
    articles: WriteOnlyMapped[List["Article"]] = relationship(
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


class MetaDetection(MyTableMixin, Base):
    __tablename__ = "meta_detections"

    confidence: Mapped[float] = mapped_column(nullable=True)
    value: Mapped[str] = mapped_column(default="", nullable=False)


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
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Title.title_id"
    )
    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Title.sub_title_id"
    )


class Volume(MyTableMixin, Base):
    __tablename__ = "volumes"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(
        back_populates="volumes", foreign_keys="Volume.collection_id"
    )

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(index=True, nullable=True)

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.part_number_id"
    )

    part_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    part_name: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.part_name_id"
    )

    date_issued_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    date_issued: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.date_issued_id"
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.title_id"
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.sub_title_id"
    )

    edition_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    edition: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.edition_id"
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    place_term: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.place_term_id"
    )

    publisher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    publisher: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.publisher_id"
    )

    manufacture_publisher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    manufacture_publisher: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.manufacture_publisher_id"
    )

    manufacture_place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    manufacture_place_term: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.manufacture_place_term_id"
    )

    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    author: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.author_id"
    )

    illustrator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    illustrator: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.illustrator_id"
    )

    translator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    translator: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.translator_id"
    )

    editor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    editor: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.editor_id"
    )

    series_name_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    series_name: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.series_name_id"
    )

    series_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    series_number: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Volume.series_number_id"
    )


class Issue(MyTableMixin, Base):
    __tablename__ = "issues"

    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id"), index=True, nullable=False
    )
    collection: Mapped["Collection"] = relationship(foreign_keys="Issue.collection_id")

    parent_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.part_number_id"
    )

    date_issued_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    date_issued: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.date_issued_id"
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.title_id"
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.sub_title_id"
    )

    place_term_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    place_term: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.place_term_id"
    )

    publisher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    publisher: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.publisher_id"
    )

    manufacture_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    manufacture: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.manufacture_id"
    )

    redaktor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    redaktor: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Issue.redaktor_id"
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
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    page_number: Mapped[Optional["MetaDetection"]] = relationship(
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
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Chapter.title_id"
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    sub_title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Chapter.sub_title_id"
    )

    part_number_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    part_number: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Chapter.part_number_id"
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
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    title: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Article.title_id"
    )

    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    author: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Article.author_id"
    )

    abstract_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    abstract: Mapped[Optional["MetaDetection"]] = relationship(
        foreign_keys="Article.abstract_id"
    )

    keywords_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("meta_detections.id"), index=True, nullable=True
    )
    keywords: Mapped[Optional["MetaDetection"]] = relationship(
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
