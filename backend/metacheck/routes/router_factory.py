import logging
import inspect
from typing import Type, Optional, List, Dict, Any, Callable, Union, TypeVar, Generic
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Type variables for the different model types
SchemaType = TypeVar('SchemaType', bound=base_objects.BaseModel)
SchemaNewType = TypeVar('SchemaNewType', bound=BaseModel)
SchemaUpdateType = TypeVar('SchemaUpdateType', bound=BaseModel)
ModelType = TypeVar('ModelType', bound=model.Base)


class CRUDRouter:
    """A router factory that registers standard CRUD routes with a decorator pattern."""
    
    def __init__(
        self,
        *,
        router: APIRouter,
        schema: Type[SchemaType],
        schema_new: Type[SchemaNewType],
        schema_update: Type[SchemaUpdateType],
        model_class: Type[ModelType],
        prefix: str,
        tags: List[str],
    ):
        """
        Initialize the CRUD router.
        
        Args:
            router: The FastAPI router to register routes with
            schema: The Pydantic schema for reading the model
            schema_new: The Pydantic schema for creating a new model
            schema_update: The Pydantic schema for updating a model
            model_class: The SQLAlchemy model class
            prefix: The route prefix (used in messages)
            tags: The OpenAPI tags for the routes
        """
        self.router = router
        self.schema = schema
        self.schema_new = schema_new
        self.schema_update = schema_update
        self.model_class = model_class
        self.prefix = prefix
        self.tags = tags
        self.entity_name = prefix.capitalize()
        self._register_crud_routes()
        
    def _register_crud_routes(self):
        """Register the standard CRUD routes with the router."""
        
        @self.router.post("", tags=self.tags)
        async def create_entity(
            entity_new: self.schema_new, db: AsyncSession = Depends(get_async_session)
        ):
            entity_dict = entity_new.model_dump()
            await crud_general.new(db, entity_dict, self.model_class)
            return {"message": f"{self.entity_name} created."}
        
        @self.router.get("/{entity_id}", response_model=self.schema, tags=self.tags)
        async def get_entity(
            entity_id: UUID, 
            db: AsyncSession = Depends(get_async_session)
        ):
            return await crud_general.get(
                db, 
                self.schema, 
                self.model_class, 
                entity_id
            )
        
        @self.router.put("", tags=self.tags)
        async def update_entity(
            entity_update: self.schema_update, db: AsyncSession = Depends(get_async_session)
        ):
            await crud_general.update_obj(db, entity_update, self.model_class)
            return {"message": f"{self.entity_name} updated."}
        
        @self.router.get("", response_model=List[self.schema], tags=self.tags)
        async def get_all_entities(
            limit: int = 1000,
            db: AsyncSession = Depends(get_async_session)
        ):
            return await crud_general.get_all(
                db, 
                self.schema, 
                self.model_class, 
                limit=limit
            )
        
        @self.router.delete("/{entity_id}", tags=self.tags)
        async def delete_entity(
            entity_id: UUID, db: AsyncSession = Depends(get_async_session)
        ):
            await crud_general.delete_obj(db, entity_id, self.model_class)
            return {"message": f"{self.entity_name} deleted."}


# Example usage:
# 
# # Create the CRUD router
# crud_router = CRUDRouter(
#     router=article_route,
#     schema=base_objects.Article,
#     schema_new=base_objects.ArticleNew,
#     schema_update=base_objects.ArticleUpdate,
#     model_class=model.Article,
#     prefix="article",
#     tags=["Article"],
# )
# 
# # Then add custom handlers directly to the router
# @article_route.get("/by-collection/{collection_id}", response_model=list[base_objects.Article], tags=["Article"])
# async def get_articles_by_collection(
#     collection_id: UUID, db: AsyncSession = Depends(get_async_session)
# ):
#     # Custom implementation here 