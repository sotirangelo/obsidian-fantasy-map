import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { MapConfig } from "../types";
import { ImageSuggestModal } from "./create-map";
import LinkLocalMapForm from "../components/LinkLocalMapForm.svelte";

export class LinkLocalMapModal extends Modal {
  private currentMapId: string;
  private featureId: string;
  private existingMaps: MapConfig[];
  private onSubmit: (mapId: string, isNew: boolean, name?: string, imagePath?: string) => void;
  private mountedForm: ReturnType<typeof mount> | null = null;

  constructor(
    app: App,
    currentMapId: string,
    featureId: string,
    existingMaps: MapConfig[],
    onSubmit: (mapId: string, isNew: boolean, name?: string, imagePath?: string) => void,
  ) {
    super(app);
    this.currentMapId = currentMapId;
    this.featureId = featureId;
    this.existingMaps = existingMaps;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    // Filter out current map and maps that already have a parent
    const linkableMaps = this.existingMaps.filter(
      (m) => m.id !== this.currentMapId && !m.parentMapId,
    );

    this.mountedForm = mount(LinkLocalMapForm, {
      target: this.contentEl,
      props: {
        existingMaps: linkableMaps,
        onBrowseImage: (cb: (path: string) => void) => {
          new ImageSuggestModal(this.app, (file) => {
            cb(file.path);
          }).open();
        },
        onSubmit: (mapId: string, isNew: boolean, name?: string, imagePath?: string) => {
          this.close();
          this.onSubmit(mapId, isNew, name, imagePath);
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
