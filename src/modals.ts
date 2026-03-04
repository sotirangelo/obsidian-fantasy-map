import {
  App,
  Modal,
  Setting,
  FuzzySuggestModal,
  TFile,
  Notice,
} from "obsidian";
import type { MapConfig, MarkerProperties } from "./types";
import { DEFAULT_MARKER_COLOR } from "./config";

export class MarkerModal extends Modal {
  private properties: MarkerProperties;
  private layerNames: string[];
  private selectedLayer: string;
  private onSubmit: (properties: MarkerProperties, layer: string) => void;
  private isEdit: boolean;

  constructor(
    app: App,
    existingProperties: MarkerProperties | null,
    layerNames: string[],
    defaultLayer: string,
    onSubmit: (properties: MarkerProperties, layer: string) => void,
  ) {
    super(app);
    this.isEdit = existingProperties !== null;
    this.properties = existingProperties
      ? { ...existingProperties }
      : {
          id: crypto.randomUUID(),
          name: "",
          note: "",
          icon: "",
          color: DEFAULT_MARKER_COLOR,
          description: "",
        };
    this.layerNames = layerNames;
    this.selectedLayer = defaultLayer;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", {
      text: this.isEdit ? "Edit Marker" : "Add Marker",
    });

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Display name for the marker")
      .addText((text) =>
        text
          .setPlaceholder("Waterdeep here")
          .setValue(this.properties.name)
          .onChange((value) => {
            this.properties.name = value;
          }),
      );

    const noteSetting = new Setting(contentEl)
      .setName("Linked note")
      .setDesc("Obsidian note to link (e.g. Cities/Waterdeep)")
      .addText((text) =>
        text
          .setPlaceholder("Cities/waterdeep")
          .setValue(this.properties.note)
          .onChange((value) => {
            this.properties.note = value;
          }),
      );

    noteSetting.addButton((btn) =>
      btn.setButtonText("Browse").onClick(() => {
        new NoteSuggestModal(this.app, (file) => {
          const notePath = file.path.replace(/\.md$/, "");
          this.properties.note = notePath;
          const inputEl = noteSetting.controlEl.querySelector("input");
          if (inputEl) inputEl.value = notePath;
        }).open();
      }),
    );

    new Setting(contentEl)
      .setName("Icon")
      .setDesc("Emoji or short text for the marker")
      .addText((text) =>
        text
          .setPlaceholder("\uD83C\uDFF0")
          .setValue(this.properties.icon)
          .onChange((value) => {
            this.properties.icon = value;
          }),
      );

    new Setting(contentEl)
      .setName("Description")
      .setDesc("Short description shown in the popup")
      .addTextArea((textarea) =>
        textarea
          .setPlaceholder("A bustling port city on the sword coast")
          .setValue(this.properties.description)
          .onChange((value) => {
            this.properties.description = value;
          }),
      );

    if (!this.isEdit && this.layerNames.length > 0) {
      new Setting(contentEl)
        .setName("Layer")
        .setDesc("Which layer to add this marker to")
        .addDropdown((dropdown) => {
          for (const name of this.layerNames) {
            dropdown.addOption(name, name);
          }
          dropdown.setValue(this.selectedLayer);
          dropdown.onChange((value) => {
            this.selectedLayer = value;
          });
        });
    }

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.isEdit ? "Save" : "Add Marker")
        .setCta()
        .onClick(() => {
          if (!this.properties.name.trim()) {
            new Notice("Marker name is required");
            return;
          }
          this.close();
          this.onSubmit(this.properties, this.selectedLayer);
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class NoteSuggestModal extends FuzzySuggestModal<TFile> {
  private onChooseCallback: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChooseCallback = onChoose;
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChooseCallback(item);
  }
}

export class MapPickerModal extends FuzzySuggestModal<MapConfig> {
  private maps: MapConfig[];
  private onChooseCallback: (map: MapConfig) => void;

  constructor(
    app: App,
    maps: MapConfig[],
    onChoose: (map: MapConfig) => void,
  ) {
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

export class DeleteConfirmModal extends Modal {
  private markerName: string;
  private onConfirm: () => void;

  constructor(app: App, markerName: string, onConfirm: () => void) {
    super(app);
    this.markerName = markerName;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Delete marker" });
    contentEl.createEl("p", {
      text: `Are you sure you want to delete "${this.markerName}"?`,
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => {
            this.close();
            this.onConfirm();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
