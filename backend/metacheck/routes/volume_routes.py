import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import volume_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@volume_route.post("", tags=["Volume"])
async def post_volume(
    volume_new: base_objects.VolumeNew, db: AsyncSession = Depends(get_async_session)
):
    volume = volume_new.model_dump()
    await crud_general.new(db, volume, model.Volume)


@volume_route.get("/{volume_id}", response_model=base_objects.Volume, tags=["Volume"])
async def get_volume(volume_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Volume, model.Volume, volume_id)


@volume_route.put("", tags=["Volume"])
async def put_volume(
    volume_update: base_objects.VolumeUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, volume_update, model.Volume)


@volume_route.get("", response_model=list[base_objects.Volume], tags=["Volume"])
async def get_volumes(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Volume, model.Volume)


@volume_route.delete("/{volume_id}", tags=["Volume"])
async def delete_volume(volume_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_general.delete_obj(db, volume_id, model.Volume)
    return {"message": "Volume deleted."}
