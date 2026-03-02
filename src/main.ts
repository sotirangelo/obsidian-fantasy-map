import { Notice, Plugin } from "obsidian";
import { FantasyMapView, FANTASY_MAP_VIEW } from "./view";
import { FantasyMapSettingTab } from "./settings";
import { MapPickerModal } from "./modals";
import { DEFAULT_SETTINGS } from "./types";
import type { FantasyMapSettings } from "./types";

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
    const data = await this.loadData();
    if (data) {
      // Migrate from old single-map settings to new multi-map format
      if (data.mapImagePath !== undefined && data.maps === undefined) {
        const oldPath = String(data.mapImagePath ?? "");
        const oldFolder = String(data.layerFolder ?? "");
        const oldDefault = String(data.defaultLayerFile ?? "");

        this.settings = {
          maps: oldPath
            ? [
                {
                  id: crypto.randomUUID(),
                  name:
                    oldPath
                      .split("/")
                      .pop()
                      ?.replace(/\.\w+$/, "") ?? "Map",
                  mapImagePath: oldPath,
                  layerFolder: oldFolder,
                  defaultLayerFile: oldDefault,
                },
              ]
            : [],
        };
        await this.saveSettings();
      } else {
        this.settings = Object.assign(
          {},
          DEFAULT_SETTINGS,
          data,
        ) as FantasyMapSettings;
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
