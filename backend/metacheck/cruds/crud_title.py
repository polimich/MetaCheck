import logging
from typing import List
from uuid import UUID

from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)

# Will contain implementations moved from title_routes.py
# For now, setup the base structure of the file 