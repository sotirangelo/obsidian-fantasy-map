import { setIcon } from "obsidian";
import * as L from "leaflet";

export function createToolbarButton(
  map: L.Map,
  options: {
    position: L.ControlPosition;
    className: string;
    title: string;
    icon: string;
    onClick: () => void;
  },
): L.Control {
  const ControlClass = L.Control.extend({
    onAdd: () => {
      const btn = L.DomUtil.create(
        "button",
        `leaflet-bar fantasy-map-toolbar-btn ${options.className}`,
      );
      btn.title = options.title;
      setIcon(btn, options.icon);
      L.DomEvent.on(btn, "click", (e) => {
        L.DomEvent.stopPropagation(e);
        options.onClick();
      });
      return btn;
    },
  });

  const control = new ControlClass({ position: options.position });
  control.addTo(map);
  return control;
}

export function createBackButton(
  map: L.Map,
  parentName: string,
  onNavigate: () => void,
): L.Control {
  const BackControl = L.Control.extend({
    onAdd: () => {
      const btn = L.DomUtil.create(
        "button",
        "leaflet-bar fantasy-map-back-btn",
      );
      btn.textContent = `↩ ${parentName}`;
      btn.title = `Back to ${parentName}`;
      L.DomEvent.on(btn, "click", (e) => {
        L.DomEvent.stopPropagation(e);
        onNavigate();
      });
      return btn;
    },
  });

  const control = new BackControl({ position: "topleft" });
  control.addTo(map);
  return control;
}

export function createScaleBar(
  map: L.Map,
  scale: {
    point1: [number, number];
    point2: [number, number];
    realDistance: number;
    unit: string;
  },
  computeBar: (pixelsPerUnit: number, maxWidth: number) => { distance: number; barPixels: number },
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
    // eslint-disable-next-line @microsoft/sdl/no-inner-html
    scaleBarDiv.innerHTML = `<div class="scale-bar-title">Scale</div><div class="scale-bar-line" style="width:${Math.round(barPixels).toString()}px"></div><div class="scale-bar-label">${distance.toString()} ${scale.unit}</div>`;
  };

  updateContent();

  const ScaleBarControl = L.Control.extend({
    onAdd: () => scaleBarDiv,
  });

  const control = new ScaleBarControl({ position: "bottomleft" });
  control.addTo(map);

  return { control, update: updateContent };
}
