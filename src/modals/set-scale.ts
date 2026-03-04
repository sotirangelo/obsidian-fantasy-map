import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import SetScaleForm from "../components/SetScaleForm.svelte";

export class SetScaleModal extends Modal {
  private onSubmit: (realDistance: number, unit: string) => void;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    onSubmit: (realDistance: number, unit: string) => void,
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.mountedForm = mount(SetScaleForm, {
      target: this.contentEl,
      props: {
        onSubmit: (realDistance: number, unit: string) => {
          this.close();
          this.onSubmit(realDistance, unit);
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
