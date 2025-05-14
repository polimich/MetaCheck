# Author: Michael Polívka xpoliv07
# Summary: Database connection setup with async session management.

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from metacheck_common.config import config

global_engine = None
global_async_session_maker = None

logger = logging.getLogger(__name__)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    global global_engine, global_async_session_maker
    if global_engine is None:
        global_engine = create_async_engine(
            config.DATABASE_URL, pool_size=20, max_overflow=60
        )
        global_async_session_maker = async_sessionmaker(
            global_engine, autocommit=False, autoflush=False
        )
    async with global_async_session_maker() as session:
        yield session


class DBError(Exception):
    pass
