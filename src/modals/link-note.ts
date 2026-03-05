import { App, FuzzySuggestModal, TFile } from "obsidian";

export class TagSuggestModal extends FuzzySuggestModal<string> {
  private onChooseCallback: (tag: string) => void;

  constructor(app: App, onChoose: (tag: string) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Browse vault tags...");
  }

  getItems(): string[] {
    const tagCounts = this.app.metadataCache.getTags();
    return Object.keys(tagCounts).map((t) => t.replace(/^#/, "")).sort();
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    this.onChooseCallback(item);
  }
}

export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
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
