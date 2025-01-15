import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import page_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@page_route.post("", tags=["Page"])
async def post_page(
    page_new: base_objects.PageNew, db: AsyncSession = Depends(get_async_session)
):
    page = page_new.model_dump()
    await crud_general.new(db, page, model.Page)


@page_route.get("/{page_id}", response_model=base_objects.Page, tags=["Page"])
async def get_page(page_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Page, model.Page, page_id)


@page_route.put("", tags=["Page"])
async def put_page(
    page_update: base_objects.PageUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, page_update, model.Page)


@page_route.get("", response_model=list[base_objects.Page], tags=["Page"])
async def get_pages(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Page, model.Page)


@page_route.delete("/{page_id}", tags=["Page"])
async def delete_page(page_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_general.delete_obj(db, page_id, model.Page)
    return {"message": "Page deleted."}
