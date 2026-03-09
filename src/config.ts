import type * as L from "leaflet";

export const MAP_CONFIG = {
  minZoom: -5,
  maxZoom: 5,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
} satisfies L.MapOptions;

export const DEFAULT_MARKER_COLOR = "#3388ff";
