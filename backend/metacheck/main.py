import logging
import logging.config
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from metacheck.database import DBError
from metacheck.routes import (
    collection_route,
    image_route,
    debug_route,
    detection_route,
    meta_role_route,
    meta_element_route,
    meta_element_type_route,
    meta_element_detection_route,
    meta_element_detection_attribute_type_route,
)
from metacheck_common.config import config

exception_logger = logging.getLogger("scribble_sense.exception_logger")
exception_logger.propagate = False


logger = logging.getLogger(__name__)


tags_metadata = [
    {
        "name": "Collection",
        "description": "",
    },
    {
        "name": "Image",
        "description": "",
    },
    {
        "name": "MetaElement",
        "description": "",
    },
    {
        "name": "MetaElementType",
        "description": "",
    },
    {
        "name": "MetaElementDetection",
        "description": "",
    },
    {
        "name": "MetaElementDetectionAttributeType",
        "description": "",
    },
]


app = FastAPI(
    openapi_tags=tags_metadata,
    title="MetaCheck",
    version="0.1.0",
    root_path=config.APP_URL_ROOT,
)


@app.on_event("startup")
async def startup():
    logging.config.dictConfig(config.LOGGING_CONFIG)


app.include_router(collection_route, prefix="/api/collection")
app.include_router(image_route, prefix="/api/image")
app.include_router(debug_route, prefix="/api/debug")
app.include_router(detection_route, prefix="/api/detection")
app.include_router(meta_role_route, prefix="/api/meta_role")
app.include_router(meta_element_route, prefix="/api/meta_element")
app.include_router(meta_element_type_route, prefix="/api/meta_element_type")
app.include_router(meta_element_detection_route, prefix="/api/meta_element_detection")
app.include_router(meta_element_detection_attribute_type_route, prefix="/api/meta_element_detection_attribute_type")

if os.path.isdir("metacheck/static"):
    app.mount("/", StaticFiles(directory="metacheck/static", html=True), name="static")


@app.exception_handler(Exception)
async def unicorn_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, DBError):
        # DBError exceptions are already logged when they are raised
        return JSONResponse(status_code=400, content={"message": str(exc)})
    else:
        exception_logger.error(f"URL: {request.url}")
        exception_logger.error(f"CLIENT: {request.client}")
        exception_logger.exception(exc)
        return Response(status_code=500)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if config.PRODUCTION:
    logging.warning(f"PRODUCTION")
else:
    logging.warning(f"DEVELOPMENT")
