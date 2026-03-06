import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { MarkerProperties, PolygonProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";
import { NoteSuggestModal, TagSuggestModal, FeatureSuggestModal } from "./link-note";
import FeatureForm from "../components/FeatureForm.svelte";

export class MarkerModal extends Modal {
  private properties: MarkerProperties;
  private layerOptions: { id: string; name: string }[];
  private selectedLayerId: string;
  private onSubmit: (properties: MarkerProperties, layerId: string) => void;
  private onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void;
  private allFeatures: { id: string; name: string }[];
  private isEdit: boolean;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    existingProperties: MarkerProperties | null,
    layerOptions: { id: string; name: string }[],
    defaultLayerId: string,
    onSubmit: (properties: MarkerProperties, layerId: string) => void,
    onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void,
    allFeatures: { id: string; name: string }[] = [],
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
    this.allFeatures = allFeatures;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.mountedForm = mount(FeatureForm, {
      target: contentEl,
      props: {
        featureType: "marker" as const,
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
        allFeatures: this.allFeatures,
        onBrowseFeature: (cb: (featureId: string, featureName: string) => void) => {
          new FeatureSuggestModal(this.app, this.allFeatures, (feature) => {
            cb(feature.id, feature.name);
          }).open();
        },
        onSubmit: (props: MarkerProperties | PolygonProperties, layerId: string) => {
          this.close();
          this.onSubmit(props as MarkerProperties, layerId);
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
