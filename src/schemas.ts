import * as v from "valibot";

export const LayerConfigSchema = v.object({
  id: v.string(),
  name: v.string(),
});

export const MapConfigSchema = v.object({
  id: v.string(),
  name: v.string(),
  mapImagePath: v.string(),
  layers: v.optional(v.array(LayerConfigSchema), []),
  defaultLayerId: v.optional(v.string(), ""),
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
