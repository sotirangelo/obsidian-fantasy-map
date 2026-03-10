import { App, Modal, Setting } from "obsidian";

export class NameInputModal extends Modal {
  private defaultValue: string;
  private onSubmit: (name: string) => void;

  constructor(
    app: App,
    defaultValue: string,
    onSubmit: (name: string) => void,
  ) {
    super(app);
    this.defaultValue = defaultValue;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.setTitle("Add layer");

    let value = this.defaultValue;
    let errorEl: HTMLElement | null = null;

    new Setting(contentEl).setName("Layer name").addText((text) => {
      text.setValue(value).onChange((v) => {
        value = v;
        if (errorEl && v.trim()) {
          errorEl.remove();
          errorEl = null;
        }
      });
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      setTimeout(() => {
        text.inputEl.focus();
      }, 0);
    });

    const submit = () => {
      const name = value.trim();
      if (!name) {
        errorEl ??= contentEl.createEl("p", {
          text: "Layer name is required",
          cls: "fantasy-map-form-error",
        });
        return;
      }
      this.close();
      this.onSubmit(name);
    };

    new Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Add").setCta().onClick(submit);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
