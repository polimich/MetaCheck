from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BaseEntity(BaseModel):
    """Base entity with common fields for all models."""
    
    id: UUID
    created_date: datetime
    last_change: datetime
    last_access: datetime
    deleted: bool
    
    class Config:
        from_attributes = True 