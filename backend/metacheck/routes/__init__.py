from fastapi import APIRouter

# Author: Michael Polívka xpoliv07
# Summary: Initializes and imports FastAPI routers for various application modules.

collection_route = APIRouter()
image_route = APIRouter()
debug_route = APIRouter()
detection_route = APIRouter()
meta_role_route = APIRouter()
meta_element_route = APIRouter()
meta_element_type_route = APIRouter()
meta_element_detection_route = APIRouter()
meta_element_detection_attribute_type_route = APIRouter()

# First import generic route utilities
from .router_factory import CRUDRouter

# Then import all route modules
from .collection_routes import collection_route
from .image_routes import image_route
from .debug_routes import debug_route
from .detection_routes import detection_route
from .meta_role_routes import meta_role_route
from .meta_element_routes import meta_element_route
from .meta_element_type_routes import meta_element_type_route
from .meta_element_detection_routes import meta_element_detection_route
from .meta_element_detection_attribute_type_routes import meta_element_detection_attribute_type_route
