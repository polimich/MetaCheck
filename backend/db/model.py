import json
import math
import uuid
from datetime import datetime
from typing import List

import numpy as np
from sqlalchemy import ForeignKey, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase, relationship, WriteOnlyMapped

from metacheck.schemas.base_objects import WorkState

# converts ORM row object to dict
orm2dict = lambda r: {c.name: getattr(r, c.name) for c in r.__table__.columns}

# converts CORE row object to dict
row2dict = lambda r: dict(r._mapping)


class Base(DeclarativeBase):
    pass


class Detection(Base):
    __tablename__ = 'detections'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('images.id'), index=True, nullable=False)

    type: Mapped[str] = mapped_column(nullable=False)
    bbox: Mapped[str] = mapped_column(nullable=False)

    confidence: Mapped[float] = mapped_column(nullable=True)

    annotated: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)

    created_date: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_change: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_access: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)

    deleted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    image: Mapped['Image'] = relationship(viewonly=True)

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


class Image(Base):
    __tablename__ = 'images'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('collections.id'), index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    order: Mapped[int] = mapped_column(nullable=False)
    height: Mapped[int] = mapped_column(nullable=False)
    width: Mapped[int] = mapped_column(nullable=False)

    confidence: Mapped[float] = mapped_column(nullable=True)

    imagehash: Mapped[str] = mapped_column(index=True)

    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)

    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)

    created_date: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_change: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_access: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)

    deleted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    collection: Mapped['Collection'] = relationship(back_populates="images", foreign_keys='Image.collection_id')
    detections: WriteOnlyMapped[List['Detection']] = relationship(back_populates="image")


class Collection(Base):
    __tablename__ = 'collections'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(default="", nullable=False)
    info: Mapped[str] = mapped_column(default="", nullable=False)

    confidence: Mapped[float] = mapped_column(nullable=True)

    work_state: Mapped[WorkState] = mapped_column(default=WorkState.NEW, nullable=False)

    image_count: Mapped[int] = mapped_column(default=0, nullable=False)
    detection_count: Mapped[int] = mapped_column(default=0, nullable=False)
    annotated_detection_count: Mapped[int] = mapped_column(default=0, nullable=False)

    created_date: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_change: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_access: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)

    deleted: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)

    preview_image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('images.id'), index=True, nullable=True)

    preview_image_height: Mapped[int] = mapped_column(default=337, nullable=False)
    preview_image_width: Mapped[int] = mapped_column(default=524, nullable=False)

    images: WriteOnlyMapped[List['Image']] = relationship(back_populates='collection', foreign_keys='Image.collection_id')
    titles: WriteOnlyMapped[List['Title']] = relationship(back_populates='collection', foreign_keys='Title.collection_id')


class Title(Base):
    __tablename__ = 'titles'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('collections.id'), index=True, nullable=False)
    collection: Mapped['Collection'] = relationship(back_populates="titles", foreign_keys='Title.collection_id')

    title: Mapped[str] = mapped_column(default="", nullable=False)
    sub_title: Mapped[str] = mapped_column(default="", nullable=False)

    created_date: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_change: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)
    last_access: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True, nullable=False)

    deleted: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)


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
