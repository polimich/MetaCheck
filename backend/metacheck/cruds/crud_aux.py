import logging
from typing import List, Union

from sqlalchemy import update, bindparam
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from db import model
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


async def update_all(
    db: Union[AsyncConnection, AsyncSession],
    obj: List[base_objects.BaseModel],
    table: model.Base,
    exclude_none=True,
):
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
