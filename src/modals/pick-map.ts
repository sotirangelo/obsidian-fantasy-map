import { App, FuzzySuggestModal } from "obsidian";
import type { MapConfig } from "../types";

export class MapPickerModal extends FuzzySuggestModal<MapConfig> {
  private maps: MapConfig[];
  private onChooseCallback: (map: MapConfig) => void;

  constructor(app: App, maps: MapConfig[], onChoose: (map: MapConfig) => void) {
    super(app);
    this.maps = maps;
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Choose a map to open");
  }

  getItems(): MapConfig[] {
    return this.maps;
  }

  getItemText(item: MapConfig): string {
    return item.name || item.mapImagePath || item.id;
  }

  onChooseItem(item: MapConfig): void {
    this.onChooseCallback(item);
  }
}
