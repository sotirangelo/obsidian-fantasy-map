import * as v from "valibot";
import { App, Modal, Setting } from "obsidian";

const UNITS = ["km", "miles", "m", "ft", "leagues"];

const ScaleSchema = v.object({
  distance: v.pipe(
    v.string(),
    v.nonEmpty("Please enter a distance"),
    v.transform(parseFloat),
    v.check(
      (n) => !isNaN(n) && n > 0,
      "Please enter a valid positive distance",
    ),
  ),
  unit: v.string(),
});

export class SetScaleModal extends Modal {
  constructor(
    app: App,
    onSubmit: (realDistance: number, unit: string) => void,
    onCancel?: () => void,
  ) {
    super(app);
    this.containerEl.addClass("fantasy-map-modal");
    this.setTitle("Set map scale");

    this.contentEl.createEl("p", {
      text: "Enter the real-world distance between the two points you selected.",
      cls: "setting-item-description",
    });

    let distance = "";
    let unit = "km";
    let errorEl: HTMLElement | null = null;
    let submitted = false;

    new Setting(this.contentEl)
      .setName("Distance")
      .setDesc("Real-world distance between the two calibration points")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.setAttribute("min", "0.001");
        text.inputEl.setAttribute("step", "any");
        text.setPlaceholder("100").onChange((val) => {
          distance = val;
          if (errorEl) {
            errorEl.remove();
            errorEl = null;
          }
        });
      })
      .addDropdown((dd) => {
        UNITS.forEach((u) => {
          dd.addOption(u, u);
        });
        dd.setValue("km").onChange((val) => {
          unit = val;
        });
      });

    const submit = () => {
      const result = v.safeParse(ScaleSchema, { distance, unit });
      if (!result.success) {
        const msg = result.issues[0].message;
        errorEl ??= this.contentEl.createEl("p", {
          text: msg,
          cls: "fantasy-map-form-error",
        });
        return;
      }
      submitted = true;
      this.close();
      onSubmit(result.output.distance, result.output.unit);
    };

    new Setting(this.contentEl).addButton((btn) =>
      btn.setButtonText("Save scale").setCta().onClick(submit),
    );

    this.onClose = () => {
      if (!submitted) onCancel?.();
    };
  }
}
