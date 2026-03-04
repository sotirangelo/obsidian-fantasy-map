import { App, Modal, Setting } from "obsidian";

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
