import type * as L from "leaflet";
import type * as v from "valibot";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type {
  MapConfigSchema,
  MapScaleSchema,
  FantasyMapSettingsSchema,
  LayerConfigSchema,
} from "./schemas";
import type { App, MetadataCache } from "obsidian";

// Obsidian internal APIs not exposed in the public type definitions
export interface ObsidianInternalPlugin {
  instance: {
    openGlobalSearch(query: string): void;
  };
}

export interface ObsidianApp extends App {
  internalPlugins?: {
    getPluginById?: (id: string) => ObsidianInternalPlugin | undefined;
  };
}

export interface ExtendedMetadataCache extends MetadataCache {
  getTags(): Record<string, number>;
}

export type LayerConfig = v.InferOutput<typeof LayerConfigSchema>;
export type MapConfig = v.InferOutput<typeof MapConfigSchema>;
export type MapScale = v.InferOutput<typeof MapScaleSchema>;
export type FantasyMapSettings = v.InferOutput<typeof FantasyMapSettingsSchema>;

export const DEFAULT_SETTINGS: FantasyMapSettings = {
  maps: [],
};

export interface FeatureRelation {
  featureId: string;
  label: string;
}

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
  relations?: FeatureRelation[];
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
  relations?: FeatureRelation[];
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
