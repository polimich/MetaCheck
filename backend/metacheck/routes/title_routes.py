import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import title_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@title_route.post("", tags=["Title"])
async def post_title(
    title_new: base_objects.TitleNew, db: AsyncSession = Depends(get_async_session)
):
    title = title_new.model_dump()
    await crud_general.new(db, title, model.Title)


@title_route.get("/{title_id}", response_model=base_objects.Title, tags=["Title"])
async def get_title(title_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Title, model.Title, title_id)


@title_route.put("", tags=["Title"])
async def put_title(
    title_update: base_objects.TitleUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, title_update, model.Title)


@title_route.get("", response_model=list[base_objects.Title], tags=["Title"])
async def get_titles(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Title, model.Title)


@title_route.delete("/{title_id}", tags=["Title"])
async def delete_title(title_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_general.delete_obj(db, title_id, model.Title)
    return {"message": "Title deleted."}
