import * as L from "leaflet";

export function createScaleBar(
  map: L.Map,
  scale: {
    point1: [number, number];
    point2: [number, number];
    realDistance: number;
    unit: string;
  },
  computeBar: (
    pixelsPerUnit: number,
    maxWidth: number,
  ) => { distance: number; barPixels: number },
): { control: L.Control; update: () => void } {
  const scaleBarDiv = L.DomUtil.create("div", "fantasy-map-scale-bar");

  const updateContent = (): void => {
    const p1 = L.latLng(scale.point1[0], scale.point1[1]);
    const p2 = L.latLng(scale.point2[0], scale.point2[1]);
    const screenPx = map
      .latLngToContainerPoint(p1)
      .distanceTo(map.latLngToContainerPoint(p2));
    const pixelsPerUnit = screenPx / scale.realDistance;
    const { distance, barPixels } = computeBar(pixelsPerUnit, 200);
    scaleBarDiv.replaceChildren();

    const title = document.createElement("div");
    title.className = "scale-bar-title";
    title.textContent = "Scale";

    const line = document.createElement("div");
    line.className = "scale-bar-line";
    line.style.width = `${Math.round(barPixels).toString()}px`;

    const label = document.createElement("div");
    label.className = "scale-bar-label";
    label.textContent = `${distance.toString()} ${scale.unit}`;

    scaleBarDiv.append(title, line, label);
  };

  updateContent();

  const ScaleBarControl = L.Control.extend({
    onAdd: () => scaleBarDiv,
  });

  const control = new ScaleBarControl({ position: "bottomleft" });
  control.addTo(map);

  return { control, update: updateContent };
}
