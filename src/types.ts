import type * as L from "leaflet";
import type * as v from "valibot";
import type {
  MapConfigSchema,
  FantasyMapSettingsSchema,
  LayerConfigSchema,
} from "./schemas";

export type LayerConfig = v.InferOutput<typeof LayerConfigSchema>;
export type MapConfig = v.InferOutput<typeof MapConfigSchema>;
export type FantasyMapSettings = v.InferOutput<typeof FantasyMapSettingsSchema>;

export const DEFAULT_SETTINGS: FantasyMapSettings = {
  maps: [],
};

export interface MarkerProperties {
  id: string;
  name: string;
  note: string;
  icon: string;
  color: string;
  description: string;
}

export interface MapFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [x, y] in pixel space
  };
  properties: MarkerProperties;
}

export interface MapFeatureCollection {
  type: "FeatureCollection";
  features: MapFeature[];
}

export interface LoadedLayer {
  config: LayerConfig;
  filePath: string;
  data: MapFeatureCollection;
  leafletLayer: L.GeoJSON | null;
}
