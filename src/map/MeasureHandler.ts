import * as L from "leaflet";
import { pixelDistance } from "./scales";
import type { MapConfig } from "src/types";

export type MeasureMode = "off" | "active";

const DOT_STYLE = {
  radius: 6,
  color: "#3498db",
  fillColor: "#3498db",
  fillOpacity: 1,
} as const;

export class MeasureHandler {
  mode: MeasureMode = "off";
  private points: L.LatLng[] = [];
  private dots: L.CircleMarker[] = [];
  private segments: L.Polyline[] = [];
  private totalHost: L.CircleMarker | null = null;

  private onDone?: () => void;

  constructor(
    private map: L.Map,
    private getConfig: () => MapConfig | undefined,
  ) {}

  start(onDone?: () => void): void {
    this.clearLayers();
    this.mode = "active";
    this.onDone = onDone;
    this.map.getContainer().classList.add("is-measuring");
  }

  handleClick(latlng: L.LatLng): void {
    if (this.mode !== "active") return;

    this.points.push(latlng);

    const dot = L.circleMarker(latlng, DOT_STYLE).addTo(this.map);
    this.dots.push(dot);

    if (this.points.length >= 2) {
      const prev = this.points[this.points.length - 2]!;
      const segPx = pixelDistance(
        [prev.lat, prev.lng],
        [latlng.lat, latlng.lng],
      );
      const segment = L.polyline([prev, latlng], {
        color: "#3498db",
        dashArray: "6,4",
        weight: 2,
      }).addTo(this.map);
      segment.bindTooltip(this.formatDistance(segPx), {
        permanent: true,
        direction: "center",
        className: "fantasy-map-measure-label",
      });
      this.segments.push(segment);
    }

    this.refreshTotalTooltip();
  }

  cleanup(): void {
    this.clearLayers();
    this.mode = "off";
    this.onDone?.();
  }

  private refreshTotalTooltip(): void {
    if (this.totalHost) {
      this.totalHost.unbindTooltip();
      this.totalHost = null;
    }
    if (this.points.length < 2) return;
    const host = this.dots[this.dots.length - 1]!;
    host.bindTooltip(`Total: ${this.formatDistance(this.totalPx())}`, {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "fantasy-map-measure-total",
    });
    this.totalHost = host;
  }

  private totalPx(): number {
    let sum = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      sum += pixelDistance([a.lat, a.lng], [b.lat, b.lng]);
    }
    return sum;
  }

  private formatDistance(pxDist: number): string {
    const config = this.getConfig();
    if (!config?.scale) {
      return `${Math.round(pxDist).toString()} px (no scale set)`;
    }
    const scale = config.scale;
    const unitsPerPixel = scale.realDistance / scale.pixelDistance;
    const realDist = pxDist * unitsPerPixel;
    const rounded =
      realDist >= 10 ? Math.round(realDist).toString() : realDist.toFixed(1);
    return `${rounded} ${scale.unit}`;
  }

  private clearLayers(): void {
    for (const dot of this.dots) this.map.removeLayer(dot);
    for (const seg of this.segments) this.map.removeLayer(seg);
    this.dots = [];
    this.segments = [];
    this.points = [];
    this.totalHost = null;
    this.map.getContainer().classList.remove("is-measuring");
  }
}
