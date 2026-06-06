import { App, FuzzySuggestModal } from "obsidian";

export class FeatureSuggestModal extends FuzzySuggestModal<{
  id: string;
  name: string;
}> {
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
