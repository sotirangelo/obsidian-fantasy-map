import * as v from "valibot";

const FeatureRelationSchema = v.object({
  featureId: v.string(),
  label: v.string(),
});

const FeaturePropertiesSchema = v.object({
  id: v.string(),
  name: v.string(),
  note: v.string(),
  color: v.string(),
  description: v.string(),
  localMapId: v.optional(v.string()),
  notes: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  relations: v.optional(v.array(FeatureRelationSchema)),
});

const PointGeometrySchema = v.object({
  type: v.literal("Point"),
  coordinates: v.tuple([v.number(), v.number()]),
});

const PolygonGeometrySchema = v.object({
  type: v.literal("Polygon"),
  coordinates: v.array(v.array(v.tuple([v.number(), v.number()]))),
});

const MapFeatureSchema = v.object({
  type: v.literal("Feature"),
  geometry: v.union([PointGeometrySchema, PolygonGeometrySchema]),
  properties: FeaturePropertiesSchema,
});

export const LayerConfigSchema = v.object({
  id: v.string(),
  name: v.string(),
  features: v.optional(v.array(MapFeatureSchema), []),
});

export const MapScaleSchema = v.object({
  point1: v.tuple([v.number(), v.number()]),
  point2: v.tuple([v.number(), v.number()]),
  pixelDistance: v.number(),
  realDistance: v.number(),
  unit: v.string(),
});

export const MapConfigSchema = v.object({
  id: v.string(),
  name: v.string(),
  mapImagePath: v.string(),
  layers: v.optional(v.array(LayerConfigSchema), []),
  scale: v.optional(MapScaleSchema),
  parentMapId: v.optional(v.string()),
  parentFeatureId: v.optional(v.string()),
});

export const FantasyMapSettingsSchema = v.object({
  maps: v.array(MapConfigSchema),
});
