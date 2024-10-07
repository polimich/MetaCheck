from fastapi import APIRouter

collection_route = APIRouter()
image_route = APIRouter()
debug_route = APIRouter()

from .collection_routes import collection_route
from .image_routes import image_route
from .debug_routes import debug_route
