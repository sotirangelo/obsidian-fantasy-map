import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { MarkerProperties, PolygonProperties } from "../types";
import { DEFAULT_MARKER_COLOR } from "../config";
import { NoteSuggestModal, TagSuggestModal, FeatureSuggestModal } from "./link-note";
import FeatureForm from "../components/FeatureForm.svelte";

type FeatureType = "marker" | "polygon";
type FeatureProperties = MarkerProperties | PolygonProperties;

function defaultProperties(featureType: FeatureType): FeatureProperties {
  if (featureType === "marker") {
    return {
      id: window.crypto.randomUUID(),
      name: "",
      note: "",
      icon: "",
      color: DEFAULT_MARKER_COLOR,
      description: "",
    } satisfies MarkerProperties;
  }
  return {
    id: window.crypto.randomUUID(),
    name: "",
    note: "",
    color: DEFAULT_MARKER_COLOR,
    description: "",
  } satisfies PolygonProperties;
}

export class FeatureModal extends Modal {
  private featureType: FeatureType;
  private properties: FeatureProperties;
  private layerOptions: { id: string; name: string }[];
  private selectedLayerId: string;
  private onSubmit: (properties: FeatureProperties, layerId: string) => void;
  private onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void;
  private allFeatures: { id: string; name: string }[];
  private isEdit: boolean;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    featureType: FeatureType,
    existingProperties: FeatureProperties | null,
    layerOptions: { id: string; name: string }[],
    defaultLayerId: string,
    onSubmit: (properties: FeatureProperties, layerId: string) => void,
    onLinkLocalMap?: (featureId: string, cb: (mapId: string) => void) => void,
    allFeatures: { id: string; name: string }[] = [],
  ) {
    super(app);
    this.featureType = featureType;
    this.isEdit = existingProperties !== null;
    this.properties = existingProperties ? { ...existingProperties } : defaultProperties(featureType);
    this.layerOptions = layerOptions;
    this.selectedLayerId = defaultLayerId || (layerOptions[0]?.id ?? "");
    this.onSubmit = onSubmit;
    this.onLinkLocalMap = onLinkLocalMap;
    this.allFeatures = allFeatures;
  }

  onOpen(): void {
    this.mountedForm = mount(FeatureForm, {
      target: this.contentEl,
      props: {
        featureType: this.featureType,
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
        onSubmit: (props: FeatureProperties, layerId: string) => {
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
