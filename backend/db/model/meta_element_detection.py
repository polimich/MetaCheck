import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.model.detection import Detection
from db.model.meta_element import MetaElement
from db.model.meta_role import MetaRole
from db.model.base import Entity, create_fk_relationship


class MetaElementDetection(Entity):
    """
    Connects MetaElement, MetaRole, and Detection entities together.
    Represents a meta element's role in relation to a specific detection.
    """

    __tablename__ = "meta_element_detections"

    # Foreign keys
    meta_element_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_elements.id", ondelete="CASCADE"), index=True, nullable=False
    )

    meta_role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_roles.id", ondelete="CASCADE"), index=True, nullable=False
    )

    detection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("detections.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Relationships
    meta_element: Mapped["MetaElement"] = relationship(
        "MetaElement", 
        foreign_keys=[meta_element_id],
        cascade="all"
    )

    meta_role: Mapped["MetaRole"] = relationship(
        "MetaRole", 
        foreign_keys=[meta_role_id],
        cascade="all"
    )

    detection: Mapped["Detection"] = relationship(
        "Detection", 
        foreign_keys=[detection_id],
        cascade="all"
    ) 