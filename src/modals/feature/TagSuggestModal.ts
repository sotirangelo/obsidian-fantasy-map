import { App, FuzzySuggestModal } from "obsidian";
import type { ExtendedMetadataCache } from "../../types";

export class TagSuggestModal extends FuzzySuggestModal<string> {
  private onChooseCallback: (tag: string) => void;

  constructor(app: App, onChoose: (tag: string) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Browse vault tags...");
  }

  getItems(): string[] {
    const tagCounts = (
      this.app.metadataCache as ExtendedMetadataCache
    ).getTags();
    return Object.keys(tagCounts)
      .map((t) => t.replace(/^#/, ""))
      .sort();
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    this.onChooseCallback(item);
  }
}
