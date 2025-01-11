import os
import logging
import logging.config

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from metacheck.database import DBError
from metacheck.routes import collection_route, image_route, debug_route, title_route, volume_route, issue_route

from metacheck_common.config import config

exception_logger = logging.getLogger('scribble_sense.exception_logger')
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
    }
]


app = FastAPI(openapi_tags=tags_metadata, title="MetaCheck", version="0.1.0", root_path=config.APP_URL_ROOT)


@app.on_event("startup")
async def startup():
    logging.config.dictConfig(config.LOGGING_CONFIG)


app.include_router(collection_route, prefix="/api/collection")
app.include_router(image_route, prefix="/api/image")
app.include_router(debug_route, prefix="/api/debug")
app.include_router(title_route, prefix="/api/title")
app.include_router(volume_route, prefix="/api/volume")
app.include_router(issue_route, prefix="/api/issues")

if os.path.isdir("metacheck/static"):
    app.mount("/", StaticFiles(directory="metacheck/static", html=True), name="static")


@app.exception_handler(Exception)
async def unicorn_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, DBError):
        # DBError exceptions are already logged when they are raised
        return JSONResponse(status_code=400, content={"message": str(exc)})
    else:
        exception_logger.error(f'URL: {request.url}')
        exception_logger.error(f'CLIENT: {request.client}')
        exception_logger.exception(exc)
        return Response(status_code=500)


if config.PRODUCTION:
    logging.warning(f'PRODUCTION')
else:
    logging.warning(f'DEVELOPMENT')
    # set allow origins to [URL of frontend app]
    app.add_middleware(
         CORSMiddleware,
         allow_origins=["http://localhost:9000"],
         allow_credentials=True,
         allow_methods=["*"],
         allow_headers=["*"],
     )
