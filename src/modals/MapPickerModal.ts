import { App, FuzzySuggestModal } from "obsidian";
import type { MapConfig } from 'src/types';

type PickerItem =
  | { kind: "map"; map: MapConfig; displayName: string }
  | { kind: "create" };

export class MapPickerModal extends FuzzySuggestModal<PickerItem> {
  private items: PickerItem[];
  private onChooseMap: (map: MapConfig) => void;
  private onCreateMap: (() => void) | undefined;

  constructor(
    app: App,
    maps: (MapConfig & { displayName?: string })[],
    onChoose: (map: MapConfig) => void,
    onCreate?: () => void,
  ) {
    super(app);
    this.onChooseMap = onChoose;
    this.onCreateMap = onCreate;
    this.setPlaceholder(
      onCreate ? "Choose a map or create a new one" : "Choose a map",
    );

    this.items = [
      ...(onCreate ? [{ kind: "create" as const }] : []),
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
      this.onCreateMap?.();
    } else {
      this.onChooseMap(item.map);
    }
  }
}
