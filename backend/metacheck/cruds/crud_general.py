import logging
from typing import List, Union
from uuid import UUID

from sqlalchemy import exc, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db import model
from metacheck.database import DBError
from metacheck.schemas import base_objects

logger = logging.getLogger(__name__)


volume_many_to_many_relationships = [
    'publishers', 'manufacture_publishers', 'manufacture_place_terms', 
    'authors', 'illustrators', 'translators', 'editors'
]

article_many_to_many_relationships = [
    'authors',
]

issue_many_to_many_relationships = [
    'publishers', 'manufactures', 'redaktors',
]


async def get_all(
    db: AsyncSession,
    model_class: base_objects.BaseModel,
    table: model.Base,
    limit: int = 1000,
) -> List[model.Base]:
    try:
        async with db.begin():
            # Build the query
            query = select(table).order_by(table.created_date.desc()).limit(limit)
            
            # Import here to avoid circular imports
            from sqlalchemy.orm import selectinload
            
            # Add eager loading for relationships based on model type
            if table.__name__ == 'Volume':
                for rel in volume_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Article':
                for rel in article_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Issue':
                for rel in issue_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            
            db_objects = await db.execute(query)
            db_objects = db_objects.unique().scalars().all()
            
            result = []
            for obj in db_objects:
                # Use orm2dict for the basic attributes
                obj_dict = model.orm2dict(obj)
                
                # Handle relationship lists based on model type
                if table.__name__ == 'Volume':
                    for rel in volume_many_to_many_relationships:
                        rel_objects = getattr(obj, rel)
                        if rel_objects:
                            obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                        else:
                            obj_dict[rel] = []
                elif table.__name__ == 'Article':
                    for rel in article_many_to_many_relationships:
                        rel_objects = getattr(obj, rel)
                        if rel_objects:
                            obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                        else:
                            obj_dict[rel] = []
                elif table.__name__ == 'Issue':
                    for rel in issue_many_to_many_relationships:
                        rel_objects = getattr(obj, rel)
                        if rel_objects:
                            obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                        else:
                            obj_dict[rel] = []
                
                # Validate with Pydantic
                result.append(model_class.model_validate(obj_dict))
            
            return result
    except exc.SQLAlchemyError as e:
        logger.exception(f"Failed fetching objects from database.")
        raise DBError(f"Failed fetching objects from database.") from e


async def get(
    db: AsyncSession, model_class: base_objects.BaseModel, table: model.Base, id: UUID
) -> model.Base:
    try:
        async with db.begin():
            # Build the query
            query = select(table).where(table.id == id)
            
            # Import here to avoid circular imports
            from sqlalchemy.orm import selectinload
            
            # Add eager loading for relationships based on model type
            if table.__name__ == 'Volume':
                for rel in volume_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Article':
                for rel in article_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Issue':
                for rel in issue_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            
            db_object = await db.execute(query)
            db_object = db_object.unique().scalar()
            if db_object is None:
                raise exc.SQLAlchemyError
                
            # Use orm2dict for the basic attributes
            obj_dict = model.orm2dict(db_object)
            
            # Handle relationship lists based on model type
            if table.__name__ == 'Volume':
                for rel in volume_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            elif table.__name__ == 'Article':
                for rel in article_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            elif table.__name__ == 'Issue':
                for rel in issue_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            
            # Validate with Pydantic
            return model_class.model_validate(obj_dict)
    except exc.SQLAlchemyError as e:
        logging.exception(
            f"Failed fetching object from database. Object does not exist. ID={id}"
        )
        raise DBError(
            f"Failed fetching object from database. Object does not exist. ID={id}"
        ) from e


async def get_or_none(
    db: AsyncSession, model_class: base_objects.BaseModel, table: model.Base, id: UUID
) -> Union[model.Base, None]:
    try:
        async with db.begin():
            # Build the query
            query = select(table).where(table.id == id)
            
            # Import here to avoid circular imports
            from sqlalchemy.orm import selectinload
            
            # Add eager loading for relationships based on model type
            if table.__name__ == 'Volume':
                for rel in volume_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Article':
                for rel in article_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            elif table.__name__ == 'Issue':
                for rel in issue_many_to_many_relationships:
                    query = query.options(selectinload(getattr(table, rel)))
            
            db_object = await db.execute(query)
            db_object = db_object.unique().scalar()
            if db_object is None:
                return None
                
            # Use orm2dict for the basic attributes
            obj_dict = model.orm2dict(db_object)
            
            # Handle relationship lists based on model type
            if table.__name__ == 'Volume':
                for rel in volume_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            elif table.__name__ == 'Article':
                for rel in article_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            elif table.__name__ == 'Issue':
                for rel in issue_many_to_many_relationships:
                    rel_objects = getattr(db_object, rel)
                    if rel_objects:
                        obj_dict[rel] = [model.orm2dict(rel_obj) for rel_obj in rel_objects]
                    else:
                        obj_dict[rel] = []
            
            # Validate with Pydantic
            return model_class.model_validate(obj_dict)
    except exc.SQLAlchemyError as e:
        logging.exception(f"Failed fetching object from database. ID={id}")
        raise DBError(f"Failed fetching object from database. ID={id}") from e


async def new(db: AsyncSession, obj: dict, table: model.Base):
    try:
        async with db.begin():
            db_obj = table(**obj)
            db.add(db_obj)
            await db.commit()
    except exc.SQLAlchemyError as e:
        logging.exception(
            f'Failed adding object to database. Could be that the object already exists. ID={obj["id"]}'
        )
        raise DBError(
            f'Failed adding object to database. Could be that the object already exists. ID={obj["id"]}'
        ) from e


async def update_obj(
    db: AsyncSession, obj: base_objects.BaseModel, table: model.Base, exclude_none=True
):
    try:
        async with db.begin():
            data = obj.model_dump(exclude={"id"}, exclude_none=exclude_none)
            stm = update(table).where(table.id == obj.id).values(data)
            await db.execute(stm)
    except exc.SQLAlchemyError as e:
        logging.exception(f"Failed updating object in database.")
        raise DBError(f"Failed updating object in database.") from e


async def delete_obj(db: AsyncSession, id: UUID, table: model.Base):
    try:
        async with db.begin():
            stm = delete(table).where(table.id == id)
            await db.execute(stm)
    except exc.SQLAlchemyError as e:
        logging.exception(
            f"Failed deleting object in database. Object probably does not exist. ID={id}"
        )
        raise DBError(
            f"Failed deleting object in database. Object probably does not exist. ID={id}"
        ) from e
