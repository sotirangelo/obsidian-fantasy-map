import { App, FuzzySuggestModal } from "obsidian";
import type { MapConfig } from "../types";

type PickerItem =
  | { kind: "map"; map: MapConfig; displayName: string }
  | { kind: "create" };

export class MapPickerModal extends FuzzySuggestModal<PickerItem> {
  private items: PickerItem[];
  private onChooseMap: (map: MapConfig) => void;
  private onCreateMap: () => void;

  constructor(
    app: App,
    maps: (MapConfig & { displayName?: string })[],
    onChoose: (map: MapConfig) => void,
    onCreate: () => void,
  ) {
    super(app);
    this.onChooseMap = onChoose;
    this.onCreateMap = onCreate;
    this.setPlaceholder("Choose a map or create a new one");

    this.items = [
      { kind: "create" },
      ...maps.map((m) => ({
        kind: "map" as const,
        map: m,
        displayName:
          m.displayName ?? (m.name || m.mapImagePath || m.id),
      })),
    ];
  }

  getItems(): PickerItem[] {
    return this.items;
  }

  getItemText(item: PickerItem): string {
    return item.kind === "create"
      ? "+ Create new map"
      : item.displayName;
  }

  onChooseItem(item: PickerItem): void {
    if (item.kind === "create") {
      this.onCreateMap();
    } else {
      this.onChooseMap(item.map);
    }
  }
}
