import type * as L from "leaflet";

export const MAP_CONFIG = {
  minZoom: -5,
  maxZoom: 5,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
} satisfies L.MapOptions;

export const GEOMAN_CONFIG = {
  position: "bottomright" as const,
  drawMarker: true,
  drawCircleMarker: false,
  drawPolyline: false,
  drawRectangle: true,
  drawPolygon: true,
  drawCircle: false,
  drawText: false,
  editMode: true,
  dragMode: true,
  cutPolygon: false,
  removalMode: true,
  rotateMode: false,
};

export const MARKER_ICON_SIZE = [32, 32] as [number, number];
export const MARKER_ICON_ANCHOR = [16, 32] as [number, number];
export const MARKER_POPUP_ANCHOR = [0, -32] as [number, number];

export const DEFAULT_MARKER_COLOR = "#3388ff";

export const LAYERS_BASE_FOLDER = "fantasy-map-layers";
