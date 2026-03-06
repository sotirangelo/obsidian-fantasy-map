import { Plugin } from "obsidian";
import * as v from "valibot";
import { FantasyMapView, FANTASY_MAP_VIEW } from "./map/view";
import { MapPickerModal, CreateMapModal } from "./modals";
import { DEFAULT_SETTINGS } from "./types";
import type { FantasyMapSettings } from "./types";
import { FantasyMapSettingsSchema, LegacySettingsSchema } from "./schemas";

export default class FantasyMapPlugin extends Plugin {
  settings: FantasyMapSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      FANTASY_MAP_VIEW,
      (leaf) => new FantasyMapView(leaf, this),
    );

    this.addRibbonIcon("map", "Open map", () => {
      this.openMapPicker();
    });

    this.addCommand({
      id: "open-map",
      name: "Open map",
      callback: () => {
        this.openMapPicker();
      },
    });

    this.addCommand({
      id: "create-new-map",
      name: "Create new map",
      callback: () => {
        this.openCreateMapModal();
      },
    });

  }

  private openCreateMapModal(): void {
    new CreateMapModal(this.app, (name: string, imagePath: string) => {
      const newMap = {
        id: window.crypto.randomUUID(),
        name,
        mapImagePath: imagePath,
        layers: [],
        defaultLayerId: "",
      };
      this.settings.maps.push(newMap);
      void this.saveSettings().then(() => this.openMap(newMap.id));
    }).open();
  }

  private openMapPicker(): void {
    const { maps } = this.settings;

    // Build display list: local maps shown with parent context
    const parentMap = new Map(maps.map((m) => [m.id, m.name || m.id]));
    const displayMaps = maps.map((m) => ({
      ...m,
      displayName: m.parentMapId
        ? `↳ ${m.name || m.id} (in ${parentMap.get(m.parentMapId) ?? m.parentMapId})`
        : m.name || m.id,
    }));

    new MapPickerModal(
      this.app,
      displayMaps,
      (map) => {
        void this.openMap(map.id);
      },
      () => {
        this.openCreateMapModal();
      },
    ).open();
  }

  async openMap(mapId: string): Promise<void> {
    const { workspace } = this.app;

    // Reuse existing fantasy map leaf, or create one if none exists
    const leaves = workspace.getLeavesOfType(FANTASY_MAP_VIEW);
    const leaf = leaves[0] ?? workspace.getLeaf("tab");
    await leaf.setViewState({
      type: FANTASY_MAP_VIEW,
      active: true,
      state: { mapId },
    });
    await workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data: unknown = await this.loadData();
    if (!data) return;

    // Migrate from old single-map settings to new multi-map format
    const legacyResult = v.safeParse(LegacySettingsSchema, data);
    if (legacyResult.success) {
      const { mapImagePath } = legacyResult.output;

      this.settings = {
        maps: mapImagePath
          ? [
              {
                id: window.crypto.randomUUID(),
                name:
                  mapImagePath
                    .split("/")
                    .pop()
                    ?.replace(/\.\w+$/, "") ?? "Map",
                mapImagePath,
                layers: [],
                defaultLayerId: "",
              },
            ]
          : [],
      };
      await this.saveSettings();
      return;
    }

    const result = v.safeParse(FantasyMapSettingsSchema, data);
    if (result.success) {
      this.settings = result.output;
    } else {
      console.warn(
        "Fantasy Map: Invalid settings data, using defaults",
        result.issues,
      );
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
