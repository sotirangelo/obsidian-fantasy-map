import { Plugin, TAbstractFile } from "obsidian";
import * as v from "valibot";
import { FantasyMapView, FANTASY_MAP_VIEW } from "./map/view";
import {
  MapPickerModal,
  CreateMapModal,
  DeleteConfirmModal,
  DevModal,
} from "./modals";
import { DEFAULT_SETTINGS } from "./types";
import type { FantasyMapSettings } from "./types";
import { FantasyMapSettingsSchema } from "./schemas";

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

    if (__DEV__) {
      this.addRibbonIcon("bug", "Dev tools", () => {
        return new DevModal(this.app).open();
      });
    }

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

    this.addCommand({
      id: "delete-map",
      name: "Delete map",
      callback: () => {
        this.openDeleteMapPicker();
      },
    });

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.handleVaultRename(file, oldPath);
      }),
    );
  }

  private handleVaultRename(file: TAbstractFile, oldPath: string): void {
    const newPath = file.path;
    if (!oldPath || newPath === oldPath) return;

    const stripMd = (p: string): string =>
      p.endsWith(".md") ? p.slice(0, -3) : p;
    const oldNote = stripMd(oldPath);
    const newNote = stripMd(newPath);

    const rename = (path: string, oldP: string, newP: string): string => {
      if (path === oldP) return newP;
      if (path.startsWith(oldP + "/")) return newP + path.slice(oldP.length);
      return path;
    };

    let changed = false;
    for (const map of this.settings.maps) {
      const newImg = rename(map.mapImagePath, oldPath, newPath);
      if (newImg !== map.mapImagePath) {
        map.mapImagePath = newImg;
        changed = true;
      }
      for (const layer of map.layers) {
        for (const feature of layer.features) {
          const props = feature.properties;
          if (props.note) {
            const nn = rename(props.note, oldNote, newNote);
            if (nn !== props.note) {
              props.note = nn;
              changed = true;
            }
          }
          if (props.notes) {
            for (let i = 0; i < props.notes.length; i++) {
              const cur = props.notes[i];
              if (!cur) continue;
              const nn = rename(cur, oldNote, newNote);
              if (nn !== cur) {
                props.notes[i] = nn;
                changed = true;
              }
            }
          }
        }
      }
    }

    if (changed) void this.saveSettings();
  }

  private openCreateMapModal(): void {
    new CreateMapModal(this.app, (name: string, imagePath: string) => {
      const newMap = {
        id: window.crypto.randomUUID(),
        name,
        mapImagePath: imagePath,
        layers: [],
      };
      this.settings.maps.push(newMap);
      void this.saveSettings().then(() => this.openMap(newMap.id));
    }).open();
  }

  private openDeleteMapPicker(): void {
    const { maps } = this.settings;
    if (!maps.length) return;

    const parentMap = new Map(maps.map((m) => [m.id, m.name || m.id]));
    const displayMaps = maps.map((m) => ({
      ...m,
      displayName: m.parentMapId
        ? `↳ ${m.name || m.id} (in ${parentMap.get(m.parentMapId) ?? m.parentMapId})`
        : m.name || m.id,
    }));

    new MapPickerModal(this.app, displayMaps, (map) => {
      const childCount = maps.filter((m) => m.parentMapId === map.id).length;
      const description =
        childCount > 0
          ? `This will also delete ${String(childCount)} linked local map${childCount > 1 ? "s" : ""}. This cannot be undone.`
          : "This cannot be undone.";

      new DeleteConfirmModal(
        this.app,
        `Delete "${map.name || map.id}"?`,
        description,
        () => {
          void this.deleteMap(map.id);
        },
      ).open();
    }).open();
  }

  private async deleteMap(mapId: string): Promise<void> {
    const idsToRemove = new Set<string>();
    idsToRemove.add(mapId);
    // Collect all descendants
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of this.settings.maps) {
        if (
          m.parentMapId &&
          idsToRemove.has(m.parentMapId) &&
          !idsToRemove.has(m.id)
        ) {
          idsToRemove.add(m.id);
          changed = true;
        }
      }
    }

    this.settings.maps = this.settings.maps.filter(
      (m) => !idsToRemove.has(m.id),
    );
    await this.saveSettings();

    // Close the view if it's showing a deleted map
    for (const leaf of this.app.workspace.getLeavesOfType(FANTASY_MAP_VIEW)) {
      const view = leaf.view as FantasyMapView;
      if (view.mapId && idsToRemove.has(view.mapId)) {
        leaf.detach();
      }
    }
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
