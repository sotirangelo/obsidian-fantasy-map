import type * as L from "leaflet";

export interface MapConfig {
  id: string;
  name: string;
  mapImagePath: string;
  layerFolder: string;
  defaultLayerFile: string;
}

export interface FantasyMapSettings {
  maps: MapConfig[];
}

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
  filePath: string;
  fileName: string;
  data: MapFeatureCollection;
  leafletLayer: L.GeoJSON | null;
}
