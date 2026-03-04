import { Notice, Plugin } from "obsidian";
import * as v from "valibot";
import { FantasyMapView, FANTASY_MAP_VIEW } from "./view";
import { FantasyMapSettingTab } from "./settings";
import { MapPickerModal } from "./modals";
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

    this.addSettingTab(new FantasyMapSettingTab(this.app, this));
  }

  private openMapPicker(): void {
    const { maps } = this.settings;

    if (maps.length === 0) {
      new Notice(
        "No maps configured. Go to Settings > Fantasy Map to add a map.",
      );
      return;
    }

    if (maps.length === 1) {
      void this.openMap(maps[0].id);
      return;
    }

    new MapPickerModal(this.app, maps, (map) => {
      void this.openMap(map.id);
    }).open();
  }

  async openMap(mapId: string): Promise<void> {
    const { workspace } = this.app;

    // Check if this map is already open
    const leaves = workspace.getLeavesOfType(FANTASY_MAP_VIEW);
    for (const leaf of leaves) {
      const view = leaf.view as unknown as FantasyMapView;
      if (view.mapId === mapId) {
        await workspace.revealLeaf(leaf);
        return;
      }
    }

    const leaf = workspace.getLeaf("tab");
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
      const { mapImagePath, layerFolder, defaultLayerFile } =
        legacyResult.output;

      this.settings = {
        maps: mapImagePath
          ? [
              {
                id: crypto.randomUUID(),
                name:
                  mapImagePath
                    .split("/")
                    .pop()
                    ?.replace(/\.\w+$/, "") ?? "Map",
                mapImagePath,
                layerFolder,
                defaultLayerFile,
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
