import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { MarkerProperties, PolygonProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";
import { NoteSuggestModal, TagSuggestModal } from "./link-note";
import FeatureForm from "../components/FeatureForm.svelte";

export class PolygonModal extends Modal {
  private properties: PolygonProperties;
  private layerOptions: { id: string; name: string }[];
  private selectedLayerId: string;
  private onSubmit: (properties: PolygonProperties, layerId: string) => void;
  private onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void;
  private isEdit: boolean;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    existingProperties: PolygonProperties | null,
    layerOptions: { id: string; name: string }[],
    defaultLayerId: string,
    onSubmit: (properties: PolygonProperties, layerId: string) => void,
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
          color: DEFAULT_MARKER_COLOR,
          description: "",
        };
    this.layerOptions = layerOptions;
    this.selectedLayerId = defaultLayerId || (layerOptions[0]?.id ?? "");
    this.onSubmit = onSubmit;
    this.onLinkLocalMap = onLinkLocalMap;
  }

  onOpen(): void {
    this.mountedForm = mount(FeatureForm, {
      target: this.contentEl,
      props: {
        featureType: "polygon" as const,
        initialProperties: this.properties,
        layerOptions: this.layerOptions,
        initialLayerId: this.selectedLayerId,
        isEdit: this.isEdit,
        onBrowseNote: (cb: (path: string) => void) => {
          new NoteSuggestModal(this.app, (file) => {
            cb(file.path.replace(/\.md$/, ""));
          }).open();
        },
        onBrowseTag: (cb: (tag: string) => void) => {
          new TagSuggestModal(this.app, cb).open();
        },
        onLinkLocalMap: this.onLinkLocalMap
          ? (cb: (mapId: string) => void) => { this.onLinkLocalMap!(this.properties.id, cb); }
          : undefined,
        onSubmit: (props: MarkerProperties | PolygonProperties, layerId: string) => {
          this.close();
          this.onSubmit(props as PolygonProperties, layerId);
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
