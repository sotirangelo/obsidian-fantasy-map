import * as L from "leaflet";
import type { MarkerProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";

const DOT_SIZE = 12;

export function createMarkerFromFeature(
  props: MarkerProperties,
  latlng: L.LatLng,
): L.Marker {
  const color = props.color || DEFAULT_MARKER_COLOR;

  const icon = L.divIcon({
    className: "fantasy-map-dot-icon",
    html: `<span class="marker-dot" style="background:${color};"></span>`,
    iconSize: [DOT_SIZE, DOT_SIZE],
    iconAnchor: [DOT_SIZE / 2, DOT_SIZE / 2],
  });

  return L.marker(latlng, { draggable: true, icon });
}
