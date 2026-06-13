import type * as L from "leaflet";
import type { MapConfig } from "src/types";
import { createScaleBar } from "./controls";
import { pickNiceDistance } from "./scales";

export class ScaleBarController {
  private control: L.Control | null = null;
  private update: (() => void) | null = null;

  constructor(private map: L.Map) {}

  render(config: MapConfig): void {
    if (!config.scale) return;
    this.dispose();
    const { control, update } = createScaleBar(
      this.map,
      config.scale,
      pickNiceDistance,
    );
    this.control = control;
    this.update = update;
    this.map.on("zoomend", update);
  }

  dispose(): void {
    if (this.control) {
      this.control.remove();
      this.control = null;
    }
    if (this.update) {
      this.map.off("zoomend", this.update);
      this.update = null;
    }
  }
}
