import { App, Modal, Setting } from "obsidian";

export class RelationLabelModal extends Modal {
  private onSubmit: (label: string) => void;

  constructor(app: App, onSubmit: (label: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.setTitle("Add relation");

    let value = "";

    new Setting(contentEl)
      .setName("Relation type")
      .setDesc("Optional label describing the kind of relation, such as ally, enemy, or capital of")
      .addText((text) => {
        text.setPlaceholder("Ally, enemy, capital of...").onChange((v) => {
          value = v;
        });
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
        setTimeout(() => { text.inputEl.focus(); }, 0);
      });

    const submit = () => {
      this.close();
      this.onSubmit(value.trim());
    };

    new Setting(contentEl).addButton((btn) => {
      btn.setButtonText("Add").setCta().onClick(submit);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
