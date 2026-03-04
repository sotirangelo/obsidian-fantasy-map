import * as v from "valibot";

export const LayerConfigSchema = v.object({
  id: v.string(),
  name: v.string(),
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
  defaultLayerId: v.optional(v.string(), ""),
  scale: v.optional(MapScaleSchema),
  parentMapId: v.optional(v.string()),
  parentFeatureId: v.optional(v.string()),
});

export const FantasyMapSettingsSchema = v.object({
  maps: v.array(MapConfigSchema),
});

/** Schema for detecting legacy single-map format (pre-multi-map migration). */
export const LegacySettingsSchema = v.object({
  mapImagePath: v.string(),
  layerFolder: v.optional(v.string(), ""),
  defaultLayerFile: v.optional(v.string(), ""),
  maps: v.optional(v.undefined()),
});
