import { App, Modal, Setting, Notice } from "obsidian";
import type { MarkerProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";
import { NoteSuggestModal } from "./link-note";

export class MarkerModal extends Modal {
  private properties: MarkerProperties;
  private layerOptions: { id: string; name: string }[];
  private selectedLayerId: string;
  private onSubmit: (properties: MarkerProperties, layerId: string) => void;
  private isEdit: boolean;

  constructor(
    app: App,
    existingProperties: MarkerProperties | null,
    layerOptions: { id: string; name: string }[],
    defaultLayerId: string,
    onSubmit: (properties: MarkerProperties, layerId: string) => void,
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
    this.layerOptions = layerOptions;
    this.selectedLayerId = defaultLayerId || (layerOptions[0]?.id ?? "");
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

    if (!this.isEdit && this.layerOptions.length > 0) {
      new Setting(contentEl)
        .setName("Layer")
        .setDesc("Which layer to add this marker to")
        .addDropdown((dropdown) => {
          for (const opt of this.layerOptions) {
            dropdown.addOption(opt.id, opt.name);
          }
          dropdown.setValue(this.selectedLayerId);
          dropdown.onChange((value) => {
            this.selectedLayerId = value;
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
          this.onSubmit(this.properties, this.selectedLayerId);
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
