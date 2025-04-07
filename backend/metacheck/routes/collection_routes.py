import logging
from uuid import UUID

from fastapi import Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_collection, crud_general
from metacheck.database import get_async_session
from metacheck.routes import collection_route
from metacheck.routes.router_factory import CRUDRouter
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Register standard CRUD routes
crud_router = CRUDRouter(
    router=collection_route,
    schema=base_objects.Collection,
    schema_new=base_objects.CollectionNew,
    schema_update=base_objects.CollectionUpdate,
    model_class=model.Collection,
    prefix="collection",
    tags=["Collection"],
)

# Custom routes

@collection_route.get(
    "/{collection_id}/images",
    response_model=list[base_objects.Image],
    tags=["Collection"],
)
async def get_collection_images(
    collection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    """Get all images belonging to a specific collection"""
    return await crud_collection.get_collection_images(db, collection_id)


@collection_route.post("/import_yolo", tags=["Import"])
async def import_collection_yolo(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    """Import a YOLO formatted dataset"""
    return await crud_collection.import_yolo_collection(file, db)


@collection_route.post("/import_metakat", tags=["Import"])
async def import_collection_metakat(
    file: UploadFile, db: AsyncSession = Depends(get_async_session)
):
    """Import a MetaKat formatted dataset"""
    return await crud_collection.import_metakat_collection(file, db)
