import { Notice } from "obsidian";
import * as L from "leaflet";
import { pixelDistance } from "./scales";
import { SetScaleModal } from "../modals";

export type CalibrationMode = "off" | "point1" | "point2";

export class CalibrationHandler {
  mode: CalibrationMode = "off";
  private point1: L.LatLng | null = null;
  private tempLayers: L.Layer[] = [];

  constructor(
    private map: L.Map,
    private getApp: () => InstanceType<typeof import("obsidian").App>,
    private onComplete: (
      p1: [number, number],
      p2: [number, number],
      pxDist: number,
      realDistance: number,
      unit: string,
    ) => void,
  ) {}

  start(): void {
    this.mode = "point1";
    this.clearTempLayers();
    this.map.getContainer().classList.add("is-calibrating");
    new Notice("Click the first calibration point on the map");
  }

  handleClick(latlng: L.LatLng): void {
    if (this.mode === "point1") {
      this.point1 = latlng;
      const circle = L.circleMarker(latlng, {
        radius: 6,
        color: "#e74c3c",
        fillColor: "#e74c3c",
        fillOpacity: 1,
      }).addTo(this.map);
      this.tempLayers.push(circle);
      this.mode = "point2";
      new Notice("Click the second calibration point on the map");
    } else if (this.mode === "point2" && this.point1) {
      const p1 = this.point1;
      const circle2 = L.circleMarker(latlng, {
        radius: 6,
        color: "#e74c3c",
        fillColor: "#e74c3c",
        fillOpacity: 1,
      }).addTo(this.map);
      this.tempLayers.push(circle2);

      const line = L.polyline([p1, latlng], {
        color: "#e74c3c",
        dashArray: "6,4",
      }).addTo(this.map);
      this.tempLayers.push(line);

      this.mode = "off";
      this.map.getContainer().classList.remove("is-calibrating");

      const pxDist = pixelDistance([p1.lat, p1.lng], [latlng.lat, latlng.lng]);

      new SetScaleModal(this.getApp(), (realDistance, unit) => {
        this.clearTempLayers();
        this.onComplete(
          [p1.lat, p1.lng],
          [latlng.lat, latlng.lng],
          pxDist,
          realDistance,
          unit,
        );
      }).open();
    }
  }

  cleanup(): void {
    this.clearTempLayers();
    this.mode = "off";
    this.point1 = null;
  }

  private clearTempLayers(): void {
    for (const layer of this.tempLayers) {
      this.map.removeLayer(layer);
    }
    this.tempLayers = [];
  }
}
