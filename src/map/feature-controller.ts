import * as L from "leaflet";
import { Notice } from "obsidian";
import {
  FeatureModal,
  FeatureSuggestModal,
  DeleteConfirmModal,
  RelationLabelModal,
} from "../modals";
import type {
  LoadedLayer,
  MarkerFeature,
  MarkerProperties,
  PolygonFeature,
  PolygonProperties,
} from "../types";
import type { MapContext } from "./context";
import type { LocalMapLinker } from "./local-map";
import { getAllFeatureRefs } from "./sidebar-state";

type PromptAddLayer = (onCreated: () => void) => void;

export class FeatureController {
  constructor(
    private ctx: MapContext,
    private localMapLinker: LocalMapLinker,
    private promptAddLayer: PromptAddLayer,
  ) {}

  private getLayerOptions(): { id: string; name: string }[] {
    return this.ctx.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
    }));
  }

  openAddMarker(latlng: L.LatLng): void {
    const layerOptions = this.getLayerOptions();

    if (layerOptions.length === 0) {
      this.promptAddLayer(() => this.openAddMarker(latlng));
      return;
    }

    new FeatureModal(
      this.ctx.app,
      "marker",
      null,
      layerOptions,
      (properties, selectedLayerId) => {
        const feature: MarkerFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [latlng.lng, latlng.lat],
          },
          properties,
        };

        const layer = this.ctx.layers.find(
          (l) => l.config.id === selectedLayerId,
        );
        if (!layer) {
          new Notice("Layer not found");
          return;
        }

        layer.data.features.push(feature);
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      },
      (featureId, cb) => {
        this.localMapLinker.openLinkForNew(featureId, cb);
      },
      getAllFeatureRefs(this.ctx.layers),
      undefined,
      this.ctx.config.scale?.unit,
    ).open();
  }

  openAddPolygon(polygon: L.Polygon): void {
    const layerOptions = this.getLayerOptions();

    if (layerOptions.length === 0) {
      this.promptAddLayer(() => this.openAddPolygon(polygon));
      return;
    }

    new FeatureModal(
      this.ctx.app,
      "polygon",
      null,
      layerOptions,
      (properties, selectedLayerId) => {
        const latLngs = polygon.getLatLngs() as L.LatLng[][];
        const coordinates: [number, number][][] = latLngs.map((ring) =>
          ring.map((ll) => [ll.lng, ll.lat] as [number, number]),
        );
        for (const ring of coordinates) {
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
            ring.push(first);
          }
        }

        const feature: PolygonFeature = {
          type: "Feature",
          geometry: { type: "Polygon", coordinates },
          properties,
        };

        const layer = this.ctx.layers.find(
          (l) => l.config.id === selectedLayerId,
        );
        if (!layer) {
          new Notice("Layer not found");
          return;
        }

        layer.data.features.push(feature);
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      },
      (featureId, cb) => {
        this.localMapLinker.openLinkForNew(featureId, cb);
      },
      getAllFeatureRefs(this.ctx.layers),
      undefined,
      this.ctx.config.scale?.unit,
    ).open();
  }

  edit(
    featureType: "marker" | "polygon",
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
  ): void {
    const layerOptions = this.getLayerOptions();
    new FeatureModal(
      this.ctx.app,
      featureType,
      properties,
      layerOptions,
      (updatedProperties, selectedLayerId) => {
        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as { id: string }).id === properties.id,
        );
        if (featureIndex < 0) return;

        if (selectedLayerId && selectedLayerId !== layer.config.id) {
          const targetLayer = this.ctx.layers.find(
            (l) => l.config.id === selectedLayerId,
          );
          if (targetLayer) {
            const [feature] = layer.data.features.splice(featureIndex, 1);
            if (!feature) return;
            feature.properties = updatedProperties;
            targetLayer.data.features.push(feature);
            void this.ctx.saveLayer(layer);
            void this.ctx.saveLayer(targetLayer);
            this.ctx.refreshMapLayers();
          }
        } else {
          const f = layer.data.features[featureIndex];
          if (f) f.properties = updatedProperties;
          void this.ctx.saveLayer(layer);
          this.ctx.refreshMapLayers();
        }
      },
      (featureId, cb) => {
        this.localMapLinker.openLinkForNew(featureId, cb);
      },
      getAllFeatureRefs(this.ctx.layers, properties.id),
      layer.config.id,
      this.ctx.config.scale?.unit,
    ).open();
  }

  addRelation(
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
  ): void {
    const allFeatures = getAllFeatureRefs(this.ctx.layers, properties.id);
    new FeatureSuggestModal(this.ctx.app, allFeatures, (feature) => {
      new RelationLabelModal(this.ctx.app, (label) => {
        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as { id: string }).id === properties.id,
        );
        if (featureIndex < 0) return;
        const fAdd = layer.data.features[featureIndex];
        if (!fAdd) return;
        const props = fAdd.properties as MarkerProperties | PolygonProperties;
        const relations = props.relations ?? [];
        if (relations.some((r) => r.featureId === feature.id)) return;
        props.relations = [...relations, { featureId: feature.id, label }];
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      }).open();
    }).open();
  }

  removeRelation(
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
    targetFeatureId: string,
  ): void {
    const targetName =
      getAllFeatureRefs(this.ctx.layers).find((f) => f.id === targetFeatureId)
        ?.name ?? targetFeatureId;
    const modal = new DeleteConfirmModal(
      this.ctx.app,
      "Delete Relation",
      `Are you sure you want to delete the relation to "${targetName}"`,
      () => {
        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as { id: string }).id === properties.id,
        );
        if (featureIndex < 0) return;
        const fRem = layer.data.features[featureIndex];
        if (!fRem) return;
        const props = fRem.properties as MarkerProperties | PolygonProperties;
        props.relations = (props.relations ?? []).filter(
          (r) => r.featureId !== targetFeatureId,
        );
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      },
    );
    modal.open();
  }

  delete(
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
  ): void {
    const modal = new DeleteConfirmModal(
      this.ctx.app,
      "Delete Marker",
      `Are you sure you want to delete marker "${properties.name}"`,
      () => {
        layer.data.features = layer.data.features.filter(
          (f) => (f.properties as { id: string }).id !== properties.id,
        );
        void this.ctx.saveLayer(layer);
        this.ctx.refreshMapLayers();
      },
    );
    modal.open();
  }
}
