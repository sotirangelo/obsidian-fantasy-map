import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import ConfirmDelete from "../components/ConfirmDelete.svelte";

export class DeleteConfirmModal extends Modal {
  private title: string;
  private description: string;
  private onConfirm: () => void;
  private mountedPanel: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    title: string,
    description: string,
    onConfirm: () => void,
  ) {
    super(app);
    this.title = title;
    this.description = description;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    this.mountedPanel = mount(ConfirmDelete, {
      target: this.contentEl,
      props: {
        title: this.title,
        description: this.description,
        onConfirm: () => {
          this.close();
          this.onConfirm();
        },
        onCancel: () => {
          this.close();
        },
      },
    });
  }

  onClose(): void {
    if (this.mountedPanel) {
      void unmount(this.mountedPanel);
      this.mountedPanel = null;
    }
    this.contentEl.empty();
  }
}
