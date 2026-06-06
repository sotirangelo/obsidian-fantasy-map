import { LinkLocalMapModal } from 'src/modals';
import type { LoadedLayer, MapFeature } from 'src/types';
import type { MapContext } from "./context";

export class LocalMapLinker {
  constructor(private ctx: MapContext) {}

  openLinkForNew(featureId: string, cb: (mapId: string) => void): void {
    const { mapId } = this.ctx;
    const modal = new LinkLocalMapModal(
      this.ctx.app,
      mapId,
      featureId,
      this.ctx.plugin.settings.maps,
      (linkedMapId, isNew, name, imagePath) => {
        if (isNew && name && imagePath) {
          this.ctx.plugin.settings.maps.push({
            id: linkedMapId,
            name,
            mapImagePath: imagePath,
            layers: [],
            parentMapId: mapId,
            parentFeatureId: featureId,
          });
        } else if (!isNew) {
          const target = this.ctx.plugin.settings.maps.find(
            (m) => m.id === linkedMapId,
          );
          if (target) {
            target.parentMapId = mapId;
            target.parentFeatureId = featureId;
          }
        }
        void this.ctx.plugin.saveSettings();
        cb(linkedMapId);
      },
    );
    modal.open();
  }

  openLinkForExisting(feature: MapFeature, layer: LoadedLayer): void {
    const { mapId } = this.ctx;
    const featureId = (feature.properties as { id: string }).id;

    const modal = new LinkLocalMapModal(
      this.ctx.app,
      mapId,
      featureId,
      this.ctx.plugin.settings.maps,
      (linkedMapId, isNew, name, imagePath) => {
        if (isNew && name && imagePath) {
          this.ctx.plugin.settings.maps.push({
            id: linkedMapId,
            name,
            mapImagePath: imagePath,
            layers: [],
            parentMapId: mapId,
            parentFeatureId: featureId,
          });
        } else if (!isNew) {
          const target = this.ctx.plugin.settings.maps.find(
            (m) => m.id === linkedMapId,
          );
          if (target) {
            target.parentMapId = mapId;
            target.parentFeatureId = featureId;
          }
        }

        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as { id: string }).id === featureId,
        );
        if (featureIndex >= 0) {
          const fLink = layer.data.features[featureIndex];
          if (fLink) {
            (fLink.properties as { localMapId?: string }).localMapId =
              linkedMapId;
          }
        }

        void this.ctx.plugin.saveSettings();
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      },
    );
    modal.open();
  }
}
