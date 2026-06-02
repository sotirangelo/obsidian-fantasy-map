import * as L from "leaflet";

function offsetRing(ring: L.LatLng[], radius: number): L.LatLng[] {
  const n = ring.length;
  if (n === 0) return ring;

  let cx = 0;
  let cy = 0;
  for (const p of ring) {
    cx += p.lng;
    cy += p.lat;
  }
  cx /= n;
  cy /= n;

  return ring.map((p) => {
    const dx = p.lng - cx;
    const dy = p.lat - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return p;
    return L.latLng(p.lat + (dy / len) * radius, p.lng + (dx / len) * radius);
  });
}

export function offsetPolygonOutward(
  latlngs: L.LatLng[] | L.LatLng[][],
  radius: number,
): L.LatLng[] | L.LatLng[][] {
  if (latlngs.length === 0) return latlngs;
  if (Array.isArray(latlngs[0])) {
    return (latlngs as L.LatLng[][]).map((ring) => offsetRing(ring, radius));
  }
  return offsetRing(latlngs as L.LatLng[], radius);
}
