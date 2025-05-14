"""
@author: Michael Polívka xpoliv07



Auxiliary functions for the CRUD operations.
"""

import logging
import os
from typing import List, Union

import cv2
import numpy as np
from aiofiles import os as aiofiles_os
from aiopath import AsyncPath
from sqlalchemy import update, bindparam
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


async def update_all(
    db: Union[AsyncConnection, AsyncSession],
    obj: List[base_objects.BaseModel],
    table: model.Base,
    exclude_none=True,
):
    try:
        if isinstance(db, AsyncSession):
            db = await db.connection()
        dict_updates = []
        for o in obj:
            dict_update = o.model_dump(exclude_none=exclude_none)
            dict_update["id_to_update"] = dict_update.pop("id")
            dict_updates.append(dict_update)
        logger.info(dict_updates)
        await db.execute(
            update(table).where(table.id == bindparam("id_to_update")), dict_updates
        )
    except Exception as e:
        logging.exception(f"Failed updating objects in database.")
        raise DBError(f"Failed updating objects in database.") from e


async def make_preview_from_image(
    image: np.ndarray, preview_path: str, resolution: int
):
    scale = (resolution / float(image.shape[0] * image.shape[1])) ** 0.5
    image = cv2.resize(image, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    preview_dir = AsyncPath(os.path.split(preview_path)[0])
    if not await preview_dir.exists():
        await aiofiles_os.makedirs(
            preview_dir, exist_ok=True
        )  # exist_ok=True is needed due to multiprocessing
    cv2.imwrite(f"{preview_path}", image)
