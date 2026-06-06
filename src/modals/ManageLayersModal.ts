import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import ManageLayersForm from "../components/ManageLayersForm.svelte";

interface LayerEntry {
  id: string;
  name: string;
  featureCount: number;
}

export class ManageLayersModal extends Modal {
  private layers: LayerEntry[];
  private onAdd: (id: string, name: string) => void;
  private onRename: (id: string, newName: string) => void;
  private onDelete: (id: string) => void;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    layers: LayerEntry[],
    onAdd: (id: string, name: string) => void,
    onRename: (id: string, newName: string) => void,
    onDelete: (id: string) => void,
  ) {
    super(app);
    this.layers = layers;
    this.setTitle("Manage layers");
    this.containerEl.addClass("fantasy-map-modal");
    this.onAdd = onAdd;
    this.onRename = onRename;
    this.onDelete = onDelete;
  }

  onOpen(): void {
    this.mountedForm = mount(ManageLayersForm, {
      target: this.contentEl,
      props: {
        initialLayers: this.layers,
        onAdd: this.onAdd,
        onRename: this.onRename,
        onDelete: this.onDelete,
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
