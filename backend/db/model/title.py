import uuid
from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.base import Entity


class Title(Entity):
    """Title metadata entity."""

    __tablename__ = "titles"

    # Foreign keys
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    sub_title_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("detections.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Relationships - Use string references to avoid circular imports
    collection: Mapped["Collection"] = relationship(
        "Collection", back_populates="titles", foreign_keys=[collection_id]
    )

    title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[title_id]
    )

    sub_title: Mapped[Optional["Detection"]] = relationship(
        "Detection", foreign_keys=[sub_title_id]
    )
