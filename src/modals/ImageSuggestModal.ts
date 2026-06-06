import { App, FuzzySuggestModal, TFile } from "obsidian";

export class ImageSuggestModal extends FuzzySuggestModal<TFile> {
  private onChooseCallback: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Choose a map image");
  }

  getItems(): TFile[] {
    return this.app.vault
      .getFiles()
      .filter((f) => /^(png|jpe?g|webp)$/i.test(f.extension));
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChooseCallback(item);
  }
}
