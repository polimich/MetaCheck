from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import detection_route
from metacheck.schemas import base_objects


@detection_route.post("", tags=["Detection"])
async def post_detection(
    detection_new: base_objects.DetectionNew,
    db: AsyncSession = Depends(get_async_session),
):
    detection = detection_new.model_dump()
    await crud_general.new(db, detection, model.Detection)


@detection_route.get(
    "/{detection_id}", response_model=base_objects.Detection, tags=["Detection"]
)
async def get_detection(
    detection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    return await crud_general.get(
        db, base_objects.Detection, model.Detection, detection_id
    )


@detection_route.put("", tags=["Detection"])
async def put_detection(
    detection_update: base_objects.DetectionUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, detection_update, model.Detection)


@detection_route.get(
    "", response_model=list[base_objects.Detection], tags=["Detection"]
)
async def get_detections(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Detection, model.Detection)


@detection_route.delete("/{detection_id}", tags=["Detection"])
async def delete_detection(
    detection_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, detection_id, model.Detection)
    return {"message": "Detection deleted."}
