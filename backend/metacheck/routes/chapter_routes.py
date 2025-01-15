import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import chapter_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@chapter_route.post("", tags=["Chapter"])
async def post_chapter(
    chapter_new: base_objects.ChapterNew, db: AsyncSession = Depends(get_async_session)
):
    chapter = chapter_new.model_dump()
    await crud_general.new(db, chapter, model.Chapter)


@chapter_route.get(
    "/{chapter_id}", response_model=base_objects.Chapter, tags=["Chapter"]
)
async def get_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Chapter, model.Chapter, chapter_id)


@chapter_route.put("", tags=["Chapter"])
async def put_chapter(
    chapter_update: base_objects.ChapterUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, chapter_update, model.Chapter)


@chapter_route.get("", response_model=list[base_objects.Chapter], tags=["Chapter"])
async def get_chapters(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Chapter, model.Chapter)


@chapter_route.delete("/{chapter_id}", tags=["Chapter"])
async def delete_chapter(
    chapter_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, chapter_id, model.Chapter)
    return {"message": "Chapter deleted."}
