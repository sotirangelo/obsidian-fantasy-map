import { App, Modal, Setting } from "obsidian";

export class DeleteConfirmModal extends Modal {
  constructor(
    app: App,
    title: string,
    description: string,
    onConfirm: () => void,
  ) {
    super(app);
    this.containerEl.addClass("fantasy-map-modal");
    this.setTitle(title);
    this.contentEl.createEl("p", { text: description });

    new Setting(this.contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .setCta()
          .onClick(() => {
            this.close();
            onConfirm();
          }),
      );
  }
}
