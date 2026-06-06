import {
  App,
  FuzzySuggestModal,
  Notice,
  renderResults,
  TFile,
  type FuzzyMatch,
} from "obsidian";

const SUPPORTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
const SUPPORTED_EXTENSIONS_RE = new RegExp(
  `^(${SUPPORTED_IMAGE_EXTENSIONS.join("|")})$`,
  "i",
);
const FILE_PICKER_ACCEPT = SUPPORTED_IMAGE_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");

interface ImageSelectionItem {
  type: "vault" | "external_action";
  title: string;
  file?: TFile;
}

export class ImageSuggestModal extends FuzzySuggestModal<ImageSelectionItem> {
  private onChooseCallback: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChooseCallback = onChoose;
    this.containerEl.addClass("fantasy-map-modal");
    this.setTitle("Select map image");
    this.setPlaceholder("Type to search for images in your vault...");
  }

  getItems(): ImageSelectionItem[] {
    const items: ImageSelectionItem[] = [];

    items.push({
      type: "external_action",
      title: "Browse for external image...",
    });

    const files = this.app.vault.getFiles();
    for (const file of files) {
      if (SUPPORTED_EXTENSIONS_RE.test(file.extension)) {
        items.push({
          type: "vault",
          title: file.path,
          file: file,
        });
      }
    }

    return items;
  }

  getItemText(item: ImageSelectionItem): string {
    return item.title;
  }

  renderSuggestion(match: FuzzyMatch<ImageSelectionItem>, el: HTMLElement) {
    const item = match.item;

    if (item.type === "external_action") {
      const titleEl = el.createDiv();
      renderResults(titleEl, item.title, match.match);

      const descEl = el.createEl("small");
      const offset = -(item.title.length + 1);
      renderResults(
        descEl,
        "Copies an external image into your vault",
        match.match,
        offset,
      );
    } else {
      // Default rendering for vault files
      super.renderSuggestion(match, el);
    }
  }

  onChooseItem(item: ImageSelectionItem): void {
    if (item.type === "external_action") {
      this.triggerExternalImagePicker();
    } else if (item.file) {
      // Pass the selected vault file to your callback
      this.onChooseCallback(item.file);
    }
  }

  private triggerExternalImagePicker() {
    const fileInput = activeDocument.createElement("input");
    fileInput.type = "file";
    fileInput.accept = FILE_PICKER_ACCEPT;

    fileInput.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      void this.importExternalImage(file);
    });

    fileInput.click();
  }

  private async importExternalImage(file: File): Promise<void> {
    const dotIdx = file.name.lastIndexOf(".");
    const extension = dotIdx >= 0 ? file.name.slice(dotIdx + 1) : "";
    if (!SUPPORTED_EXTENSIONS_RE.test(extension)) {
      new Notice(`Unsupported image type: .${extension}`);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const baseName = dotIdx >= 0 ? file.name.slice(0, dotIdx) : file.name;
      const targetPath =
        await this.app.fileManager.getAvailablePathForAttachment(
          `${baseName}.${extension}`,
        );
      const newVaultFile = await this.app.vault.createBinary(
        targetPath,
        arrayBuffer,
      );
      new Notice(`Imported image to ${newVaultFile.path}`);
      this.onChooseCallback(newVaultFile);
    } catch (error) {
      console.error("Failed to import image:", error);
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`Error importing image: ${msg}`);
    }
  }
}
