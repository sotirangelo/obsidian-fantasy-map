import { App, FuzzySuggestModal, Modal, TFile } from "obsidian";
import { mount, unmount } from "svelte";
import CreateMapForm from "../components/CreateMapForm.svelte";

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

export class CreateMapModal extends Modal {
  private onSubmit: (name: string, imagePath: string) => void;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(app: App, onSubmit: (name: string, imagePath: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.mountedForm = mount(CreateMapForm, {
      target: this.contentEl,
      props: {
        onBrowseImage: (cb: (path: string) => void) => {
          new ImageSuggestModal(this.app, (file) => {
            cb(file.path);
          }).open();
        },
        onSubmit: (name: string, imagePath: string) => {
          this.close();
          this.onSubmit(name, imagePath);
        },
      },
    });
  }

  onClose(): void {
    if (this.mountedForm) {
      void unmount(this.mountedForm);
      this.mountedForm = null;
    }
    this.contentEl.empty();
  }
}
