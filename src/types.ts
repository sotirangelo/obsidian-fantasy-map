import type * as L from "leaflet";
import type * as v from "valibot";
import type { Feature, FeatureCollection, Point } from "geojson";
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

export type MapFeature = Feature<Point, MarkerProperties>;
export type MapFeatureCollection = FeatureCollection<Point, MarkerProperties>;

export interface LoadedLayer {
  config: LayerConfig;
  filePath: string;
  data: MapFeatureCollection;
  leafletLayer: L.GeoJSON | null;
}
