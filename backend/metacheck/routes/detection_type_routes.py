from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import detection_type_route
from metacheck.schemas import base_objects


@detection_type_route.post("", tags=["Detection Type"])
async def post_detection_type(
    detection_type_new: base_objects.DetectionTypeNew,
    db: AsyncSession = Depends(get_async_session),
):
    detection_type = detection_type_new.model_dump()
    await crud_general.new(db, detection_type, model.DetectionType)


@detection_type_route.get(
    "/{detection_type_id}",
    response_model=base_objects.DetectionType,
    tags=["Detection Type"],
)
async def get_detection_type(
    detection_type_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    return await crud_general.get(
        db, base_objects.DetectionType, model.DetectionType, detection_type_id
    )


@detection_type_route.put("", tags=["Detection Type"])
async def put_detection_type(
    detection_type_update: base_objects.DetectionTypeUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, detection_type_update, model.DetectionType)


@detection_type_route.get(
    "", response_model=list[base_objects.DetectionType], tags=["Detection Type"]
)
async def get_detection_types(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(
        db, base_objects.DetectionType, model.DetectionType
    )


@detection_type_route.delete("/{detection_type_id}", tags=["Detection Type"])
async def delete_detection_type(
    detection_type_id: UUID, db: AsyncSession = Depends(get_async_session)
):
    await crud_general.delete_obj(db, detection_type_id, model.DetectionType)
    return {"message": "Detection Type deleted."}


async def get_detection_type_by_name(name: str, db):
    detections = await get_detection_types(db)
    for detection in detections:
        if detection.name == name:
            return detection
    return None
