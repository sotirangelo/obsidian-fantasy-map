import { Notice } from "obsidian";
import * as L from "leaflet";
import { pixelDistance } from "./scales";
import type { MapConfig } from "../types";

export type MeasureMode = "off" | "point1" | "point2";

export class MeasureHandler {
  mode: MeasureMode = "off";
  private point1: L.LatLng | null = null;
  private tempLayers: L.Layer[] = [];
  private resultPopup: L.Popup | null = null;

  private onDone?: () => void;

  constructor(
    private map: L.Map,
    private getConfig: () => MapConfig | undefined,
  ) {}

  start(onDone?: () => void): void {
    this.clearLayers();
    this.mode = "point1";
    this.onDone = onDone;
    this.map.getContainer().classList.add("is-measuring");
    new Notice("Click the first point to measure from");
  }

  handleClick(latlng: L.LatLng): void {
    if (this.mode === "point1") {
      this.point1 = latlng;
      const dot = L.circleMarker(latlng, {
        radius: 6,
        color: "#3498db",
        fillColor: "#3498db",
        fillOpacity: 1,
      }).addTo(this.map);
      this.tempLayers.push(dot);
      this.mode = "point2";
      new Notice("Click the second point to measure to");
    } else if (this.mode === "point2" && this.point1) {
      const p1 = this.point1;

      const dot2 = L.circleMarker(latlng, {
        radius: 6,
        color: "#3498db",
        fillColor: "#3498db",
        fillOpacity: 1,
      }).addTo(this.map);
      this.tempLayers.push(dot2);

      const line = L.polyline([p1, latlng], {
        color: "#3498db",
        dashArray: "6,4",
        weight: 2,
      }).addTo(this.map);
      this.tempLayers.push(line);

      this.mode = "off";
      this.map.getContainer().classList.remove("is-measuring");
      this.onDone?.();

      const pxDist = pixelDistance([p1.lat, p1.lng], [latlng.lat, latlng.lng]);

      const config = this.getConfig();
      let label: string;
      if (config?.scale) {
        const scale = config.scale;
        const unitsPerPixel = scale.realDistance / scale.pixelDistance;
        const realDist = pxDist * unitsPerPixel;
        const rounded =
          realDist >= 10
            ? Math.round(realDist).toString()
            : realDist.toFixed(1);
        label = `${rounded} ${scale.unit}`;
      } else {
        label = `${Math.round(pxDist).toString()} px (no scale set)`;
      }

      const midLat = (p1.lat + latlng.lat) / 2;
      const midLng = (p1.lng + latlng.lng) / 2;
      this.resultPopup = L.popup({
        closeButton: true,
        className: "fantasy-map-measure-popup",
      })
        .setLatLng([midLat, midLng])
        .setContent(`<strong>${label}</strong>`)
        .openOn(this.map);

      this.resultPopup.on("remove", () => {
        this.clearLayers();
      });
    }
  }

  cleanup(): void {
    this.clearLayers();
    this.mode = "off";
    this.point1 = null;
    this.onDone?.();
  }

  private clearLayers(): void {
    for (const layer of this.tempLayers) {
      this.map.removeLayer(layer);
    }
    this.tempLayers = [];
    if (this.resultPopup) {
      this.map.closePopup(this.resultPopup);
      this.resultPopup = null;
    }
    this.point1 = null;
    this.map.getContainer().classList.remove("is-measuring");
  }
}
