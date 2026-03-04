import { App, PluginSettingTab, Setting } from "obsidian";
import type FantasyMapPlugin from "./main";
import type { MapConfig, LayerConfig } from "./types";
import { deleteLayerFile } from "./layers";

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
            layers: [],
            defaultLayerId: "",
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

    new Setting(section).setName("Layers").setHeading();

    for (const layerConfig of mapConfig.layers) {
      new Setting(section)
        .addText((text) =>
          text
            .setPlaceholder("Layer name")
            .setValue(layerConfig.name)
            .onChange(async (value) => {
              layerConfig.name = value;
              await this.plugin.saveSettings();
            }),
        )
        .addButton((btn) =>
          btn
            .setButtonText("Remove")
            .setWarning()
            .onClick(() => {
              void deleteLayerFile(
                this.plugin.app.vault.adapter,
                mapConfig.id,
                layerConfig.id,
              ).then(() => {
                mapConfig.layers = mapConfig.layers.filter(
                  (l) => l.id !== layerConfig.id,
                );
                if (mapConfig.defaultLayerId === layerConfig.id) {
                  mapConfig.defaultLayerId = "";
                }
                void this.plugin.saveSettings();
                this.display();
              });
            }),
        );
    }

    new Setting(section).addButton((btn) =>
      btn.setButtonText("Add layer").onClick(() => {
        const newLayer: LayerConfig = {
          id: crypto.randomUUID(),
          name: "New Layer",
        };
        mapConfig.layers.push(newLayer);
        void this.plugin.saveSettings();
        this.display();
      }),
    );

    if (mapConfig.layers.length > 0) {
      new Setting(section)
        .setName("Default layer")
        .setDesc("Layer used by default when adding new markers")
        .addDropdown((dropdown) => {
          dropdown.addOption("", "— none —");
          for (const layer of mapConfig.layers) {
            dropdown.addOption(layer.id, layer.name);
          }
          dropdown.setValue(mapConfig.defaultLayerId);
          dropdown.onChange(async (value) => {
            mapConfig.defaultLayerId = value;
            await this.plugin.saveSettings();
          });
        });
    }
  }
}
