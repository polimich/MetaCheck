import { z } from 'zod';
import { WorkState } from '../data-access';
import { META_ELEMENT_TYPES } from '../frontend-state';

// Basic schemas
export const UuidSchema = z.string().uuid();

// Updated BboxSchema to handle more formats
export const BboxSchema = z.union([
  // "x,y,width,height" or "x,y,w,h"
  z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  // page number or page type detections dont have bbox
  z.string(),
]);

// Base schema for common fields
export const BaseSchema = z.object({
  created_date: z.string().optional(),
  last_change: z.string().optional(),
  last_access: z.string().optional(),
  deleted: z.boolean().optional(),
});

// MetaElement schema
export const MetaElementSchema = BaseSchema.extend({
  id: UuidSchema,
  collection_id: UuidSchema,
  meta_element_type_id: z.nativeEnum(META_ELEMENT_TYPES),
  parent_id: UuidSchema.nullable(),
  attributes: z.record(z.string(), z.unknown()),
});
export type MetaElementSchemaType = z.infer<typeof MetaElementSchema>;

// Detection schema
export const DetectionSchema = BaseSchema.extend({
  id: UuidSchema,
  image_id: UuidSchema,
  bbox: BboxSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
  annotated: z.boolean(),
  computed_type: z.string().nullable(),
  computed_color: z.string().nullable(),
  value: z.string().nullable(),
  computed_display_type: z.string().nullable(),
});
export type DetectionSchemaType = z.infer<typeof DetectionSchema>;

// Image schema
export const ImageSchema = BaseSchema.extend({
  id: UuidSchema,
  name: z.string(),
  height: z.number().int().positive(),
  width: z.number().int().positive(),
  confidence: z.number().min(0).max(1).nullable(),
  work_state: z.nativeEnum(WorkState),
  detection_count: z.number().int().nonnegative(),
  annotated_detection_count: z.number().int().nonnegative(),
  detections: z.array(DetectionSchema),
  page_meta_element: MetaElementSchema.nullable().optional(),
  order: z.number().int().nonnegative().optional(),
  page_index: z.string().optional(),
  page_index_confidence: z.number().min(0).max(1).optional(),
  page_type: z.string().optional(),
  page_type_confidence: z.number().min(0).max(1).optional(),
});
export type ImageSchemaType = z.infer<typeof ImageSchema>;

// New Collection schema
export const CollectionNewSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  description: z.string(),
  info: z.string(),
});
export type CollectionNewSchemaType = z.infer<typeof CollectionNewSchema>;

// Collection schema for full collections with all details
export const CollectionSchema = BaseSchema.extend({
  id: UuidSchema,
  name: z.string(),
  description: z.string(),
  info: z.string(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  work_state: z.nativeEnum(WorkState),
  image_count: z.number().int().nonnegative(),
  detection_count: z.number().int().nonnegative(),
  annotated_detection_count: z.number().int().nonnegative(),
  preview_image_id: UuidSchema.optional().nullable(),
  preview_image_height: z.number().int().nonnegative(),
  preview_image_width: z.number().int().nonnegative(),
  images: z.array(ImageSchema),
  meta_elements: z.array(MetaElementSchema),
});
export type CollectionSchemaType = z.infer<typeof CollectionSchema>;

// Collection list schema (for getCollections)
export const CollectionListSchema = z.array(
  BaseSchema.extend({
    id: UuidSchema,
    name: z.string(),
    description: z.string(),
    info: z.string(),
    confidence: z.number().min(0).max(1).optional().nullable(),
    work_state: z.nativeEnum(WorkState),
    image_count: z.number().int().nonnegative(),
    detection_count: z.number().int().nonnegative(),
    annotated_detection_count: z.number().int().nonnegative(),
    preview_image_id: UuidSchema.optional().nullable(),
    preview_image_height: z.number().int().nonnegative(),
    preview_image_width: z.number().int().nonnegative(),
  }),
);
export type CollectionListSchemaType = z.infer<typeof CollectionListSchema>;

// Collection update schema
export const CollectionUpdateSchema = z.object({
  id: UuidSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  info: z.string().optional(),
  work_state: z.nativeEnum(WorkState).optional(),
  preview_image_id: UuidSchema.optional().nullable(),
  last_access: z.string().optional(),
  is_public: z.boolean().optional(),
  deleted: z.boolean().optional(),
});
export type CollectionUpdateSchemaType = z.infer<typeof CollectionUpdateSchema>;

// For backward compatibility, keep the old name but point to the new schema
export const CollectionAddDtoSchema = CollectionNewSchema;
