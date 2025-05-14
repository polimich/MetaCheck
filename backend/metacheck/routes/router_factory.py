import logging
import inspect
from typing import Type, Optional, List, Dict, Any, Callable, Union, TypeVar, Generic
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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

# Author: Michael Polívka xpoliv07
# Summary: Factory class for efficiently generating standard CRUD API routes for various entity types.

class CRUDRouter:
    """A router factory that registers standard CRUD routes."""
    
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
        Initialize the CRUD router with necessary components to generate standard routes.
        Sets up routes for creating, reading, updating, and deleting entities.
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
            from fastapi import HTTPException
            
            try:
                result = await crud_general.get(
                    db, 
                    self.schema, 
                    self.model_class, 
                    entity_id
                )
                
                if result is None:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"{self.entity_name} with ID {entity_id} not found"
                    )
                
                return result
            except Exception as e:
                # Log the error
                logger.exception(f"Error fetching {self.entity_name} with ID {entity_id}: {str(e)}")
                
                # Return a 404 for "not found" cases, 500 for other errors
                if isinstance(e, HTTPException):
                    raise e
                
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to retrieve {self.entity_name}. Server error: {str(e)}"
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