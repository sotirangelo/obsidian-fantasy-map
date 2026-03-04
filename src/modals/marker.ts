import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { MarkerProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";
import { NoteSuggestModal } from "./link-note";
import MarkerForm from "../components/MarkerForm.svelte";

export class MarkerModal extends Modal {
  private properties: MarkerProperties;
  private layerOptions: { id: string; name: string }[];
  private selectedLayerId: string;
  private onSubmit: (properties: MarkerProperties, layerId: string) => void;
  private onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void;
  private isEdit: boolean;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    existingProperties: MarkerProperties | null,
    layerOptions: { id: string; name: string }[],
    defaultLayerId: string,
    onSubmit: (properties: MarkerProperties, layerId: string) => void,
    onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void,
  ) {
    super(app);
    this.isEdit = existingProperties !== null;
    this.properties = existingProperties
      ? { ...existingProperties }
      : {
          id: crypto.randomUUID(),
          name: "",
          note: "",
          icon: "",
          color: DEFAULT_MARKER_COLOR,
          description: "",
        };
    this.layerOptions = layerOptions;
    this.selectedLayerId = defaultLayerId || (layerOptions[0]?.id ?? "");
    this.onSubmit = onSubmit;
    this.onLinkLocalMap = onLinkLocalMap;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.mountedForm = mount(MarkerForm, {
      target: contentEl,
      props: {
        initialProperties: this.properties,
        layerOptions: this.layerOptions,
        initialLayerId: this.selectedLayerId,
        isEdit: this.isEdit,
        onBrowseNote: (cb: (path: string) => void) => {
          new NoteSuggestModal(this.app, (file) => {
            cb(file.path.replace(/\.md$/, ""));
          }).open();
        },
        onLinkLocalMap: this.onLinkLocalMap
          ? (cb: (mapId: string) => void) => { this.onLinkLocalMap!(this.properties.id, cb); }
          : undefined,
        onSubmit: (props: MarkerProperties, layerId: string) => {
          this.close();
          this.onSubmit(props, layerId);
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
