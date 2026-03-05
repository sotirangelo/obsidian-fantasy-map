import type * as L from "leaflet";
import type * as v from "valibot";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type {
  MapConfigSchema,
  MapScaleSchema,
  FantasyMapSettingsSchema,
  LayerConfigSchema,
} from "./schemas";

export type LayerConfig = v.InferOutput<typeof LayerConfigSchema>;
export type MapConfig = v.InferOutput<typeof MapConfigSchema>;
export type MapScale = v.InferOutput<typeof MapScaleSchema>;
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
  localMapId?: string;
  notes?: string[];
  tags?: string[];
}

export interface PolygonProperties {
  id: string;
  name: string;
  note: string;
  color: string;
  description: string;
  localMapId?: string;
  notes?: string[];
  tags?: string[];
}

export type MarkerFeature = Feature<Point, MarkerProperties>;
export type PolygonFeature = Feature<Polygon, PolygonProperties>;
export type MapFeature = MarkerFeature | PolygonFeature;
export type MapFeatureCollection = FeatureCollection;

export interface LoadedLayer {
  config: LayerConfig;
  filePath: string;
  data: MapFeatureCollection;
  leafletLayer: L.GeoJSON | null;
}
