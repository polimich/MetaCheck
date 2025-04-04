"""create_meta_model

Revision ID: 971ed423ad59
Revises: 
Create Date: 2025-04-04 22:14:47.718224

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


# revision identifiers, used by Alembic.
revision: str = '971ed423ad59'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create collections table first
    op.create_table(
        'collections',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('description', sa.String(), nullable=False, server_default=''),
        sa.Column('info', sa.String(), nullable=False, server_default=''),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('work_state', sa.String(), nullable=False, server_default='NEW'),
        sa.Column('image_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('detection_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('annotated_detection_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('preview_image_id', UUID(as_uuid=True), nullable=True),
        sa.Column('preview_image_height', sa.Integer(), nullable=False, server_default='337'),
        sa.Column('preview_image_width', sa.Integer(), nullable=False, server_default='524'),
    )
    
    # Create images table
    op.create_table(
        'images',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('collection_id', UUID(as_uuid=True), sa.ForeignKey('collections.id', ondelete='CASCADE', name='fk_images_collection_id'), nullable=False),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('imagehash', sa.String(), nullable=False),
        sa.Column('work_state', sa.String(), nullable=False, server_default='NEW'),
        sa.Column('detection_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('annotated_detection_count', sa.Integer(), nullable=False, server_default='0'),
    )
    
    # Add foreign key for preview_image_id once images table exists
    op.create_foreign_key(
        'fk_collections_preview_image_id',
        'collections', 'images',
        ['preview_image_id'], ['id'], ondelete='SET NULL'
    )
    
    # Create detections table
    op.create_table(
        'detections',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('image_id', UUID(as_uuid=True), sa.ForeignKey('images.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bbox', sa.String(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('annotated', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('value', sa.String(300), nullable=False),
    )
    
    # Create meta_element_types table
    op.create_table(
        'meta_element_types',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('name', sa.String(300), nullable=False),
    )
    
    # Create meta_element_detection_attribute_types table
    op.create_table(
        'meta_element_detection_attribute_types',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('name', sa.String(300), nullable=False),
    )
    
    # Create meta_roles table
    op.create_table(
        'meta_roles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('meta_element_type_id', UUID(as_uuid=True), sa.ForeignKey('meta_element_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meta_element_detection_attribute_type_id', UUID(as_uuid=True), sa.ForeignKey('meta_element_detection_attribute_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('color', sa.String(7), nullable=False),
    )
    
    # Create meta_elements table
    op.create_table(
        'meta_elements',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('collection_id', UUID(as_uuid=True), sa.ForeignKey('collections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meta_element_type_id', UUID(as_uuid=True), sa.ForeignKey('meta_element_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', UUID(as_uuid=True), sa.ForeignKey('meta_elements.id', ondelete='CASCADE'), nullable=True),
        sa.Column('attributes', sa.JSON(), nullable=True),
    )
    
    # Create meta_element_detections table
    op.create_table(
        'meta_element_detections',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('created_date', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_change', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_access', sa.DateTime(), nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('meta_element_id', UUID(as_uuid=True), sa.ForeignKey('meta_elements.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meta_role_id', UUID(as_uuid=True), sa.ForeignKey('meta_roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('detection_id', UUID(as_uuid=True), sa.ForeignKey('detections.id', ondelete='CASCADE'), nullable=False),
    )
    
    # Create indexes
    op.create_index('ix_collections_created_date', 'collections', ['created_date'])
    op.create_index('ix_collections_last_change', 'collections', ['last_change'])
    op.create_index('ix_collections_last_access', 'collections', ['last_access'])
    op.create_index('ix_collections_deleted', 'collections', ['deleted'])
    
    op.create_index('ix_images_created_date', 'images', ['created_date'])
    op.create_index('ix_images_last_change', 'images', ['last_change'])
    op.create_index('ix_images_last_access', 'images', ['last_access'])
    op.create_index('ix_images_deleted', 'images', ['deleted'])
    op.create_index('ix_images_collection_id', 'images', ['collection_id'])
    op.create_index('ix_images_imagehash', 'images', ['imagehash'])
    
    op.create_index('ix_detections_created_date', 'detections', ['created_date'])
    op.create_index('ix_detections_last_change', 'detections', ['last_change'])
    op.create_index('ix_detections_last_access', 'detections', ['last_access'])
    op.create_index('ix_detections_deleted', 'detections', ['deleted'])
    op.create_index('ix_detections_image_id', 'detections', ['image_id'])
    op.create_index('ix_detections_annotated', 'detections', ['annotated'])


def downgrade() -> None:
    # Drop tables in reverse order of creation to handle dependencies
    op.drop_table('meta_element_detections')
    op.drop_table('meta_elements')
    op.drop_table('meta_roles')
    op.drop_table('meta_element_detection_attribute_types')
    op.drop_table('meta_element_types')
    op.drop_table('detections')
    
    # Drop foreign key constraint on collections before dropping images
    op.drop_constraint('fk_collections_preview_image_id', 'collections', type_='foreignkey')
    
    op.drop_table('images')
    op.drop_table('collections')
