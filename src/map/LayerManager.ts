import * as L from "leaflet";
import { Notice } from "obsidian";
import { ManageLayersModal, NameInputModal } from 'src/modals';
import type {
  LayerConfig,
  LoadedLayer,
  MarkerFeature,
  MarkerProperties,
  PolygonFeature,
  PolygonProperties,
} from 'src/types';
import { offsetPolygonOutward } from "./geometry";
import { loadConfiguredLayers } from "./layers";
import type { MapContext } from "./context";
import type { SidebarStateBuilder } from "./SidebarStateBuilder";

export class LayerManager {
  constructor(
    private ctx: MapContext,
    private sidebarBuilder: SidebarStateBuilder,
  ) {}

  loadAndDisplay(): void {
    const loaded = loadConfiguredLayers(this.ctx.config.layers);
    this.ctx.layers.push(...loaded);

    for (const layer of loaded) {
      this.addToMap(layer);
    }
  }

  addToMap(layer: LoadedLayer): void {
    const rings = L.layerGroup();
    layer.rings = rings;

    const leafletLayer = L.geoJSON(layer.data, {
      pointToLayer: (feature, latlng) => {
        return this.sidebarBuilder.createInteractiveMarker(
          feature as MarkerFeature,
          latlng,
          layer,
        );
      },
      style: (feature) => {
        if (feature?.geometry.type === "Polygon") {
          const props = feature.properties as PolygonProperties;
          return {
            color: props.color,
            fillColor: props.color,
            fillOpacity: 0.3,
            weight: 2,
          };
        }
        return {};
      },
      onEachFeature: (feature, leafletFeature) => {
        const scale = this.ctx.config.scale;
        const pxPerUnit = scale ? scale.pixelDistance / scale.realDistance : 1;

        if (feature.geometry.type === "Point") {
          const props = feature.properties as MarkerProperties;
          if (props.ring) {
            const marker = leafletFeature as L.Marker;
            const circle = L.circle(marker.getLatLng(), {
              radius: props.ring.radius * pxPerUnit,
              color: props.ring.color,
              fillColor: props.ring.color,
              fillOpacity: 0.2,
              weight: 1,
              interactive: false,
              pmIgnore: true,
              className: "fantasy-map-feature-ring",
            });
            rings.addLayer(circle);
            marker.on("drag", () => circle.setLatLng(marker.getLatLng()));
          }
          return;
        }

        if (
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon"
        ) {
          const props = feature.properties as PolygonProperties;
          leafletFeature.bindTooltip(props.name, {
            permanent: true,
            direction: "center",
            className: "fantasy-map-name-tooltip",
          });
          leafletFeature.on("pm:drag", () => {
            const tooltip = leafletFeature.getTooltip();
            if (tooltip) {
              tooltip.setLatLng(
                (leafletFeature as L.Polygon).getBounds().getCenter(),
              );
            }
          });
          this.sidebarBuilder.attachPolygonInteraction(
            feature as PolygonFeature,
            leafletFeature as L.Polygon,
            layer,
          );
          if (props.ring) {
            const outerLatLngs = offsetPolygonOutward(
              (leafletFeature as L.Polygon).getLatLngs() as
                | L.LatLng[]
                | L.LatLng[][],
              props.ring.radius * pxPerUnit,
            );
            const ringPoly = L.polygon(outerLatLngs, {
              color: props.ring.color,
              fillColor: props.ring.color,
              fillOpacity: 0.2,
              weight: 1,
              interactive: false,
              pmIgnore: true,
              className: "fantasy-map-feature-ring",
            });
            rings.addLayer(ringPoly);
            ringPoly.bringToBack();
          }
        }
      },
    });
    leafletLayer.addTo(this.ctx.map);
    rings.addTo(this.ctx.map);
    this.ctx.layerControl.addOverlay(leafletLayer, layer.config.name);
    layer.leafletLayer = leafletLayer;
  }

  promptAdd(onCreated?: () => void): void {
    const defaultName = this.ctx.config.name
      ? `${this.ctx.config.name} Layer`
      : "New Layer";
    new NameInputModal(this.ctx.app, defaultName, (name) => {
      const id = window.crypto.randomUUID();
      const promise = this.create(id, name);
      if (onCreated) void promise.then(onCreated);
      else void promise;
    }).open();
  }

  async create(id: string, name: string): Promise<void> {
    const newLayerConfig: LayerConfig = {
      id,
      name,
      features: [],
    };

    this.ctx.config.layers.push(newLayerConfig);
    await this.ctx.plugin.saveSettings();

    const loaded = loadConfiguredLayers([newLayerConfig]);
    for (const layer of loaded) {
      this.ctx.layers.push(layer);
      this.addToMap(layer);
    }

    new Notice(`Layer "${name}" added`);
  }

  promptManage(): void {
    const layerEntries = this.ctx.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
      featureCount: l.data.features.length,
    }));
    new ManageLayersModal(
      this.ctx.app,
      layerEntries,
      (id, name) => void this.create(id, name),
      (id, newName) => this.rename(id, newName),
      (id) => {
        const layer = this.ctx.layers.find((l) => l.config.id === id);
        if (layer) this.delete(layer);
      },
    ).open();
  }

  rename(id: string, newName: string): void {
    const layer = this.ctx.layers.find((l) => l.config.id === id);
    if (!layer) return;
    layer.config.name = newName;
    if (layer.leafletLayer) {
      this.ctx.layerControl.removeLayer(layer.leafletLayer);
      this.ctx.layerControl.addOverlay(layer.leafletLayer, newName);
    }
    void this.ctx.plugin.saveSettings();
  }

  delete(layer: LoadedLayer): void {
    this.ctx.config.layers = this.ctx.config.layers.filter(
      (l) => l.id !== layer.config.id,
    );
    if (layer.leafletLayer) {
      this.ctx.layerControl.removeLayer(layer.leafletLayer);
      layer.leafletLayer.remove();
    }
    const idx = this.ctx.layers.findIndex(
      (l) => l.config.id === layer.config.id,
    );
    if (idx >= 0) this.ctx.layers.splice(idx, 1);
    this.ctx.selectFeature(null);
    void this.ctx.plugin.saveSettings();
    new Notice(`Layer "${layer.config.name}" deleted`);
  }
}
