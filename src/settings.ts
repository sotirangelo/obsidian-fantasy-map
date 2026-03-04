import { App, PluginSettingTab } from "obsidian";
import { mount, unmount } from "svelte";
import type FantasyMapPlugin from "./main";
import { deleteLayerFile } from "./layers";
import SettingsPanel from "./components/SettingsPanel.svelte";

export class FantasyMapSettingTab extends PluginSettingTab {
  plugin: FantasyMapPlugin;
  private mountedPanel: ReturnType<typeof mount> | null = null;

  constructor(app: App, plugin: FantasyMapPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    if (this.mountedPanel) {
      void unmount(this.mountedPanel);
      this.mountedPanel = null;
    }
    containerEl.empty();

    this.mountedPanel = mount(SettingsPanel, {
      target: containerEl,
      props: {
        settings: this.plugin.settings,
        onSave: () => this.plugin.saveSettings(),
        onDeleteLayer: (mapId: string, layerId: string) =>
          deleteLayerFile(this.plugin.app.vault.adapter, mapId, layerId),
      },
    });
  }

  hide(): void {
    if (this.mountedPanel) {
      void unmount(this.mountedPanel);
      this.mountedPanel = null;
    }
  }
}
