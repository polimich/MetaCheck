import logging
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.cruds import crud_general
from metacheck.database import get_async_session
from metacheck.routes import issue_route
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


@issue_route.post("", tags=["Issue"])
async def post_issue(
    issue_new: base_objects.IssueNew, db: AsyncSession = Depends(get_async_session)
):
    issue = issue_new.model_dump()
    await crud_general.new(db, issue, model.Issue)


@issue_route.get("/{issue_id}", response_model=base_objects.Issue, tags=["Issue"])
async def get_issue(issue_id: UUID, db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get(db, base_objects.Issue, model.Issue, issue_id)


@issue_route.put("", tags=["Issue"])
async def put_issue(
    issue_update: base_objects.IssueUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    await crud_general.update_obj(db, issue_update, model.Issue)


@issue_route.get("", response_model=list[base_objects.Issue], tags=["Issue"])
async def get_issues(db: AsyncSession = Depends(get_async_session)):
    return await crud_general.get_all(db, base_objects.Issue, model.Issue)


@issue_route.delete("/{issue_id}", tags=["Issue"])
async def delete_issue(issue_id: UUID, db: AsyncSession = Depends(get_async_session)):
    await crud_general.delete_obj(db, issue_id, model.Issue)
    return {"message": "Issue deleted."}
