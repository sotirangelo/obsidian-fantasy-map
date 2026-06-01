import { App, Modal, Notice, Setting } from "obsidian";

export class DevModal extends Modal {
  constructor(app: App, onSubmit?: (result: string) => void) {
    super(app);
    this.setTitle("Dev modal");

    this.contentEl.createEl("h2", { text: "Section heading" });
    this.contentEl.createEl("p", { text: "Some descriptive paragraph text." });
    this.contentEl.createEl("p", {
      text: "Warning text example",
      cls: "mod-warning",
    });

    let name = "";
    new Setting(this.contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        name = value;
      }),
    );

    new Setting(this.contentEl)
      .addDropdown((dropdown) => {
        dropdown
          .addOption("option1", "Option 1")
          .addOption("option2", "Option 2")
          .addOption("option3", "Option 3")
          .onChange((value) => {
            new Notice(`Selected: ${value}`);
          });
      })
      .setName("Interesting dropdown")
      .setDesc(
        "Use this dropdown to select an option. It does nothing, but it looks cool.",
      )
      .setTooltip("Some interesting tooltip");

    new Setting(this.contentEl)
      .addSearch((search) => {
        search.setPlaceholder("Search for something...").onChange((value) => {
          new Notice(`Search input: ${value}`);
        });
      })
      .setName("Some search");

    new Setting(this.contentEl).addButton((btn) =>
      btn
        .setButtonText("Submit")
        .setCta()
        .onClick(() => {
          this.close();
          onSubmit?.(name);
        }),
    );
  }
}
