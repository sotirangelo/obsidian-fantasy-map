import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import ConfirmDelete from "../components/ConfirmDelete.svelte";

export class DeleteConfirmModal extends Modal {
  private markerName: string;
  private onConfirm: () => void;
  private mountedPanel: ReturnType<typeof mount> | null = null;

  constructor(app: App, markerName: string, onConfirm: () => void) {
    super(app);
    this.markerName = markerName;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    this.mountedPanel = mount(ConfirmDelete, {
      target: this.contentEl,
      props: {
        markerName: this.markerName,
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
