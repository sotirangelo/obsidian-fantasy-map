import * as L from "leaflet";
import type { MapFeature } from "./types";
import { MARKER_ICON_SIZE, MARKER_ICON_ANCHOR, MARKER_POPUP_ANCHOR } from "./config";

// @ts-ignore - esbuild converts these to data URLs
import iconUrl from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
// @ts-ignore
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

export function fixLeafletDefaultIcons(): void {
  // delete (L.Icon.Default.prototype as unknown)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
  });
}

export function createMarkerFromFeature(
  feature: MapFeature,
  latlng: L.LatLng,
): L.Marker {
  const props = feature.properties;
  const markerOptions: L.MarkerOptions = { draggable: true };

  if (props.icon) {
    markerOptions.icon = L.divIcon({
      className: "fantasy-map-marker-icon",
      html: `<span class="marker-emoji">${props.icon}</span>`,
      iconSize: MARKER_ICON_SIZE,
      iconAnchor: MARKER_ICON_ANCHOR,
      popupAnchor: MARKER_POPUP_ANCHOR,
    });
  }

  return L.marker(latlng, markerOptions);
}
