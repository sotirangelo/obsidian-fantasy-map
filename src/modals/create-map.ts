import * as v from "valibot";
import {
  App,
  FuzzySuggestModal,
  Modal,
  Setting,
  TextComponent,
  TFile,
} from "obsidian";

const CreateMapSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Map name is required")),
  imagePath: v.pipe(v.string(), v.minLength(1, "Map image is required")),
});

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

export function renderCreateMapForm(
  container: HTMLElement,
  app: App,
  onSubmit: (name: string, imagePath: string) => void,
): void {
  let name = "";
  let imagePath = "";
  let errorEl: HTMLElement | null = null;
  let nameText!: TextComponent;
  let imageText!: TextComponent;

  const clearError = () => {
    if (errorEl) {
      errorEl.remove();
      errorEl = null;
    }
  };

  new Setting(container)
    .setName("Name")
    .setDesc("Display name for the map")
    .addText((text) => {
      nameText = text;
      text.setPlaceholder("Northern province").onChange((val) => {
        name = val;
        clearError();
      });
    });

  new Setting(container)
    .setName("Map image")
    .setDesc("Image file from your vault")
    .addText((text) => {
      imageText = text;
      text.setPlaceholder("maps/world.png").onChange((val) => {
        imagePath = val;
        clearError();
      });
    })
    .addButton((btn) =>
      btn.setButtonText("Browse").onClick(() => {
        new ImageSuggestModal(app, (file) => {
          imagePath = file.path;
          imageText.setValue(file.path);
          if (!name) {
            name =
              file.path
                .split("/")
                .pop()
                ?.replace(/\.\w+$/, "") ?? "";
            nameText.setValue(name);
          }
          clearError();
        }).open();
      }),
    );

  const submit = () => {
    const result = v.safeParse(CreateMapSchema, { name, imagePath });
    if (!result.success) {
      const msg = result.issues[0].message;
      errorEl ??= container.createEl("p", {
        text: msg,
        cls: "fantasy-map-form-error",
      });
      return;
    }
    onSubmit(result.output.name, result.output.imagePath);
  };

  new Setting(container).addButton((btn) =>
    btn.setButtonText("Create map").setCta().onClick(submit),
  );
}

export class CreateMapModal extends Modal {
  constructor(app: App, onSubmit: (name: string, imagePath: string) => void) {
    super(app);
    this.containerEl.addClass("fantasy-map-modal");
    this.setTitle("Create new map");
    renderCreateMapForm(this.contentEl, app, (name, imagePath) => {
      this.close();
      onSubmit(name, imagePath);
    });
  }
}
