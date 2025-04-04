from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional, Type, TypeVar, Union, Callable

from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.orm import Mapped, DeclarativeBase, mapped_column, relationship
from sqlalchemy.inspection import inspect

# Updated to include both table columns and SQLAlchemy computed properties
def orm2dict(r):
    """Convert ORM object to dictionary, including table columns and computed properties."""
    # Get regular table columns
    result = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    
    # Add any column_property values (computed columns)
    mapper = inspect(r.__class__)
    for prop in mapper.column_attrs:
        if prop.key not in result:  # Only add if not already added from regular columns
            result[prop.key] = getattr(r, prop.key)
    
    return result

# converts CORE row object to dict
row2dict = lambda r: dict(r._mapping)

# Type annotation for the SQLAlchemy model class
T = TypeVar('T', bound='Base')


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    # Default lazy loading strategy for all relationships
    __lazy_strategy__ = 'select'


class MyTableMixin:
    """Common fields for all entity tables."""

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


class Entity(MyTableMixin, Base):
    """Base class for all domain entities, combines MyTableMixin and Base."""

    __abstract__ = True


# Helper function to create many-to-many association tables for detections
def create_detection_association_table(
    parent_table: str,
    attribute_name: str,
    metadata: Any = Base.metadata,
    parent_column: str = None,
    target_table: str = "detections",
    target_column: str = "detection_id",
    **kwargs
) -> Table:
    """
    Creates a many-to-many association table between an entity and detections with standard configuration.

    Args:
        parent_table: Name of the parent table (e.g. "volumes")
        attribute_name: Name of the attribute in the parent class (e.g. "authors")
        metadata: SQLAlchemy metadata object
        parent_column: Name of the parent column, defaults to "{parent_table[:-1]}_id"
        target_table: Name of the target table, defaults to "detections"
        target_column: Name of the target column, defaults to "detection_id"
        **kwargs: Additional arguments to pass to the Table constructor

    Returns:
        A SQLAlchemy Table object representing the detection association table
    """
    # Convert plural parent table name to singular for column name
    parent_singular = parent_table[:-1] if parent_table.endswith('s') else parent_table
    
    if parent_column is None:
        parent_column = f"{parent_singular}_id"

    # Create table name in format: parent_singular_attribute_name_table
    table_name = f"{parent_singular}_{attribute_name}_table"

    return Table(
        table_name,
        metadata,
        Column(parent_column, ForeignKey(f"{parent_table}.id", ondelete="CASCADE"), index=True),
        Column(target_column, ForeignKey(f"{target_table}.id", ondelete="CASCADE"), index=True),
        **kwargs
    )


# Helper functions for creating common relationship patterns
def create_fk_relationship(
    target_entity: Union[str, Type[T]],
    foreign_key_column: str,
    backref_name: Optional[str] = None,
    lazy: str = None,
    cascade: str = "all, delete-orphan",
    **kwargs
) -> Callable:
    """
    Creates a standard foreign key relationship with consistent configuration.

    Args:
        target_entity: Target entity class or string name
        foreign_key_column: Name of the foreign key column
        backref_name: Name for the back reference, if any
        lazy: Lazy loading strategy, defaults to class default
        cascade: Cascade behavior, defaults to "all, delete-orphan"
        **kwargs: Additional arguments to pass to relationship

    Returns:
        A function that returns a RelationshipProperty
    """
    def relationship_factory(cls):
        nonlocal lazy
        if lazy is None:
            lazy = getattr(cls, '__lazy_strategy__', 'select')

        # Create the relationship
        rel_kwargs = {
            'lazy': lazy,
            'cascade': cascade,
            **kwargs
        }

        if backref_name:
            rel_kwargs['back_populates'] = backref_name

        return relationship(target_entity, **rel_kwargs)

    return relationship_factory