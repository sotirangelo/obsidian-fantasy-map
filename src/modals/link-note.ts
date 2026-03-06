import { App, FuzzySuggestModal, TFile } from "obsidian";
import type { ExtendedMetadataCache } from "../types";

export class FeatureSuggestModal extends FuzzySuggestModal<{ id: string; name: string }> {
  private features: { id: string; name: string }[];
  private onChooseCallback: (feature: { id: string; name: string }) => void;

  constructor(
    app: App,
    features: { id: string; name: string }[],
    onChoose: (feature: { id: string; name: string }) => void,
  ) {
    super(app);
    this.features = features;
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Search features...");
  }

  getItems(): { id: string; name: string }[] {
    return this.features;
  }

  getItemText(item: { id: string; name: string }): string {
    return item.name;
  }

  onChooseItem(item: { id: string; name: string }): void {
    this.onChooseCallback(item);
  }
}

export class TagSuggestModal extends FuzzySuggestModal<string> {
  private onChooseCallback: (tag: string) => void;

  constructor(app: App, onChoose: (tag: string) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.setPlaceholder("Browse vault tags...");
  }

  getItems(): string[] {
    const tagCounts = (this.app.metadataCache as ExtendedMetadataCache).getTags();
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
