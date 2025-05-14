import logging

import fastapi.exceptions
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from metacheck.database import get_async_session
from metacheck.routes import debug_route

logger = logging.getLogger(__name__)

# Author: Michael Polívka xpoliv07
# Summary: Debug routes for testing error handling and other development purposes.

@debug_route.get("/raise_internal_server_error",  tags=["Debug"])
async def raise_internal_server_error(db: AsyncSession = Depends(get_async_session)):
    """Intentionally raises a server error for testing error handling."""
    raise fastapi.exceptions.FastAPIError('DEBUG for INTERNAL SERVER ERROR')
