from fastapi import Depends

from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.routes import collection_route
from uuid import UUID

from metacheck.database import get_async_session
from metacheck.schemas import base_objects
from metacheck.cruds import crud_collection, crud_general


import logging


logger = logging.getLogger(__name__)


@collection_route.post("",  tags=["Collection"])
async def post_collection(collection_new: base_objects.CollectionNew, db: AsyncSession = Depends(get_async_session)):
    collection = collection_new.model_dump()
    await crud_general.new(db, collection, model.Collection)


@collection_route.get("/{collection_id}", response_model=base_objects.Collection,  tags=["Collection"])
async def get_collection(collection_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_collection.get_collection(db, collection_id)


@collection_route.put("",  tags=["Collection"])
async def put_collection(collection_update: base_objects.CollectionUpdate, db: AsyncSession = Depends(get_async_session)):
    await crud_general.update_obj(db, collection_update, model.Collection)