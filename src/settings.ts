import { App, PluginSettingTab, Setting } from "obsidian";
import type FantasyMapPlugin from "./main";
import type { MapConfig } from "./types";

export class FantasyMapSettingTab extends PluginSettingTab {
  plugin: FantasyMapPlugin;

  constructor(app: App, plugin: FantasyMapPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Maps").setHeading();

    for (const mapConfig of this.plugin.settings.maps) {
      this.renderMapConfig(containerEl, mapConfig);
    }

    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText("Add map")
        .setCta()
        .onClick(() => {
          const newMap: MapConfig = {
            id: crypto.randomUUID(),
            name: "",
            mapImagePath: "",
            layerFolder: "",
            defaultLayerFile: "",
          };
          this.plugin.settings.maps.push(newMap);
          void this.plugin.saveSettings();
          this.display();
        }),
    );
  }

  private renderMapConfig(
    containerEl: HTMLElement,
    mapConfig: MapConfig,
  ): void {
    const section = containerEl.createDiv({
      cls: "fantasy-map-config-section",
    });

    new Setting(section)
      .setName("Map name")
      .setDesc("Display name for this map")
      .addText((text) =>
        text
          .setPlaceholder("World map")
          .setValue(mapConfig.name)
          .onChange(async (value) => {
            mapConfig.name = value;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Remove")
          .setWarning()
          .onClick(() => {
            this.plugin.settings.maps = this.plugin.settings.maps.filter(
              (m) => m.id !== mapConfig.id,
            );
            void this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(section)
      .setName("Map image path")
      .setDesc("Path to the PNG image in your vault (e.g. maps/world.png)")
      .addText((text) =>
        text
          .setPlaceholder("maps/world.png")
          .setValue(mapConfig.mapImagePath)
          .onChange(async (value) => {
            mapConfig.mapImagePath = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(section)
      .setName("Layer folder")
      .setDesc(
        "Vault folder containing .geojson layer files (e.g. maps/layers)",
      )
      .addText((text) =>
        text
          .setPlaceholder("Maps/layers")
          .setValue(mapConfig.layerFolder)
          .onChange(async (value) => {
            mapConfig.layerFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(section)
      .setName("Default layer")
      .setDesc("Filename of the default layer for new markers")
      .addText((text) =>
        text
          .setPlaceholder("cities.geojson")
          .setValue(mapConfig.defaultLayerFile)
          .onChange(async (value) => {
            mapConfig.defaultLayerFile = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
