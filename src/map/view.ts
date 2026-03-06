import {
  ItemView,
  WorkspaceLeaf,
  Menu,
  Notice,
  MarkdownRenderer,
} from "obsidian";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { mount, unmount } from "svelte";
import type { Polygon } from "geojson";
import type FantasyMapPlugin from "../main";
import type {
  LoadedLayer,
  MapConfig,
  LayerConfig,
  MapFeature,
  MarkerFeature,
  PolygonFeature,
  MarkerProperties,
  PolygonProperties,
  ObsidianApp,
  SidebarState,
} from "../types";
import { loadConfiguredLayers } from "./layers";
import { createMarkerFromFeature, fixLeafletDefaultIcons } from "./markers";
import {
  FeatureModal,
  DeleteConfirmModal,
  LinkLocalMapModal,
  NameInputModal,
} from "../modals";
import { MAP_CONFIG, GEOMAN_CONFIG } from "../config";
import { pickNiceDistance } from "./scales";
import {
  createToolbarButton,
  createBackButton,
  createScaleBar,
} from "./controls";
import { CalibrationHandler } from "./calibration";
import { MeasureHandler } from "./measure";
import Sidebar from "../components/Sidebar.svelte";

export const FANTASY_MAP_VIEW = "fantasy-map-view";

export class FantasyMapView extends ItemView {
  plugin: FantasyMapPlugin;
  map: L.Map | null = null;
  layers: LoadedLayer[] = [];
  mapContainerEl: HTMLDivElement | null = null;
  mapId: string | null = null;
  private blobUrl: string | null = null;
  private layerControl: L.Control.Layers | null = null;
  private sidebarEl: HTMLDivElement | null = null;
  private sidebarComponent: ReturnType<typeof mount> | null = null;
  private updateSidebar: ((state: SidebarState | null) => void) | null = null;
  private scaleBarControl: L.Control | null = null;
  private updateScaleBar: (() => void) | null = null;
  private calibration: CalibrationHandler | null = null;
  private measure: MeasureHandler | null = null;
  private selectedLayer: L.Layer | null = null;
  private selectionRing: L.CircleMarker | null = null;
  private relationHighlights: L.CircleMarker[] = [];
  private relationArrows: L.Layer[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: FantasyMapPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return FANTASY_MAP_VIEW;
  }

  getDisplayText(): string {
    const config = this.getMapConfig();
    return config?.name ?? "Fantasy Map";
  }

  getIcon(): string {
    return "map";
  }

  getState(): Record<string, unknown> {
    return { mapId: this.mapId };
  }

  async setState(state: unknown, result: unknown): Promise<void> {
    const s = state as Record<string, unknown> | null;
    if (s && typeof s.mapId === "string") {
      this.mapId = s.mapId;
    }
    await super.setState(state, result as Parameters<ItemView["setState"]>[1]);
    await this.renderMap();
  }

  async onOpen(): Promise<void> {
    fixLeafletDefaultIcons();
    await this.renderMap();
  }

  private async renderMap(): Promise<void> {
    this.cleanup();

    const container = this.contentEl;
    container.empty();
    container.addClass("fantasy-map-wrapper");

    const config = this.getMapConfig();
    if (!config) {
      container.createEl("p", {
        text: "No map configured. Use the 'Create new map' command or go to Settings > Fantasy Map.",
        cls: "fantasy-map-notice",
      });
      return;
    }

    if (!config.mapImagePath) {
      container.createEl("p", {
        text: "No map image configured. Go to Settings > Fantasy Map to set a map image path.",
        cls: "fantasy-map-notice",
      });
      return;
    }

    this.sidebarEl = container.createDiv({
      cls: "fantasy-map-sidebar fantasy-map-sidebar--hidden",
    });

    this.mapContainerEl = container.createDiv({ cls: "fantasy-map-container" });
    this.sidebarComponent = mount(Sidebar, {
      target: this.sidebarEl,
      props: {
        registerUpdate: (fn: (state: SidebarState | null) => void) => {
          this.updateSidebar = fn;
        },
      },
    });

    try {
      const imageUrl = await this.getImageUrl(config.mapImagePath);
      this.blobUrl = imageUrl;
      const dimensions = await this.getImageDimensions(imageUrl);
      this.initializeMap(imageUrl, dimensions, config);
      await this.loadAndDisplayLayers(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      container.createEl("p", {
        text: `Failed to load map: ${message}`,
        cls: "fantasy-map-error",
      });
    }

    // Update the tab title
    (this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
  }

  private getMapConfig(): MapConfig | undefined {
    if (!this.mapId) return undefined;
    return this.plugin.settings.maps.find((m) => m.id === this.mapId);
  }

  private cleanup(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    if (this.sidebarComponent) {
      void unmount(this.sidebarComponent);
      this.sidebarComponent = null;
    }
    this.updateSidebar = null;
    this.sidebarEl = null;
    this.layers = [];
    this.layerControl = null;
    this.scaleBarControl = null;
    this.updateScaleBar = null;
    this.clearSelection();
    this.calibration?.cleanup();
    this.calibration = null;
    this.measure?.cleanup();
    this.measure = null;
  }

  async onClose(): Promise<void> {
    this.cleanup();
  }

  // --- Image Loading ---

  private async getImageUrl(vaultPath: string): Promise<string> {
    const adapter = this.app.vault.adapter;
    const exists = await adapter.exists(vaultPath);
    if (!exists) {
      throw new Error(`Map image not found: ${vaultPath}`);
    }
    const arrayBuffer = await adapter.readBinary(vaultPath);
    const blob = new Blob([arrayBuffer], { type: "image/png" });
    return URL.createObjectURL(blob);
  }

  private getImageDimensions(
    url: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for dimension detection"));
      };
      img.src = url;
    });
  }

  // --- Map Initialization ---

  private initializeMap(
    imageUrl: string,
    dimensions: { width: number; height: number },
    config: MapConfig,
  ): void {
    if (!this.mapContainerEl) return;

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [dimensions.height, dimensions.width],
    ];

    this.map = L.map(this.mapContainerEl, {
      crs: L.CRS.Simple,
      zoomControl: false,
      ...MAP_CONFIG,
    });

    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.imageOverlay(imageUrl, bounds).addTo(this.map);
    this.map.fitBounds(bounds);

    this.layerControl = L.control
      .layers({}, {}, { position: "topright" })
      .addTo(this.map);

    this.map.pm.addControls(GEOMAN_CONFIG);

    // Initialize calibration and measure handlers
    this.calibration = new CalibrationHandler(
      this.map,
      () => this.app,
      (p1, p2, pxDist, realDistance, unit) => {
        const cfg = this.getMapConfig();
        if (!cfg) return;
        cfg.scale = {
          point1: p1,
          point2: p2,
          pixelDistance: pxDist,
          realDistance,
          unit,
        };
        void this.plugin.saveSettings().then(() => {
          this.renderScaleBar(cfg);
          new Notice(
            `Scale set: ${realDistance.toString()} ${unit} between the two points`,
          );
        });
      },
    );

    this.measure = new MeasureHandler(this.map, () => this.getMapConfig());

    // Toolbar controls
    createToolbarButton(this.map, {
      position: "topright",
      className: "fantasy-map-scale-btn",
      title: "Set Scale",
      icon: "pencil-ruler",
      onClick: () => this.calibration?.start(),
    });

    createToolbarButton(this.map, {
      position: "topright",
      className: "fantasy-map-measure-btn",
      title: "Measure Distance",
      icon: "ruler",
      onClick: () => this.measure?.start(),
    });

    createToolbarButton(this.map, {
      position: "topright",
      className: "fantasy-map-add-layer-btn",
      title: "Add Layer",
      icon: "layers",
      onClick: () => {
        this.promptAddLayer(config);
      },
    });

    // Parent map navigation (for local maps)
    if (config.parentMapId) {
      const parentConfig = this.plugin.settings.maps.find(
        (m) => m.id === config.parentMapId,
      );
      const parentName = parentConfig?.name ?? "Parent Map";
      createBackButton(this.map, parentName, () => {
        void this.plugin.openMap(config.parentMapId!);
      });
    }

    // Scale bar (if scale already configured)
    if (config.scale) {
      this.renderScaleBar(config);
    }

    // When a shape is created via the Geoman toolbar
    this.map.on("pm:create", (e: { shape: string; layer: L.Layer }) => {
      if (e.shape === "Marker") {
        const marker = e.layer as L.Marker;
        const latlng = marker.getLatLng();
        this.map?.removeLayer(marker);
        this.openAddMarkerModal(latlng);
      } else if (e.shape === "Polygon" || e.shape === "Rectangle") {
        const polygon = e.layer as L.Polygon;
        this.map?.removeLayer(polygon);
        this.openAddPolygonModal(polygon);
      }
    });

    // Click on map background
    this.map.on("click", (e: L.LeafletMouseEvent) => {
      if (this.calibration && this.calibration.mode !== "off") {
        this.calibration.handleClick(e.latlng);
        return;
      }
      if (this.measure && this.measure.mode !== "off") {
        this.measure.handleClick(e.latlng);
        return;
      }
      this.selectFeature(null);
    });

    // Right-click to add a marker
    this.map.on("contextmenu", (e: L.LeafletMouseEvent) => {
      if (this.calibration && this.calibration.mode !== "off") return;
      if (this.measure && this.measure.mode !== "off") return;
      this.showAddMarkerMenu(e);
    });
  }

  // --- Scale Bar ---

  private renderScaleBar(config: MapConfig): void {
    if (!this.map || !config.scale) return;

    if (this.scaleBarControl) {
      this.scaleBarControl.remove();
      this.scaleBarControl = null;
    }
    if (this.updateScaleBar) {
      this.map.off("zoomend", this.updateScaleBar);
      this.updateScaleBar = null;
    }

    const { control, update } = createScaleBar(
      this.map,
      config.scale,
      pickNiceDistance,
    );
    this.scaleBarControl = control;
    this.updateScaleBar = update;
    this.map.on("zoomend", this.updateScaleBar);
  }

  // --- Layer Management ---

  private promptAddLayer(config: MapConfig): void {
    const defaultName = config.name ? `${config.name} Layer` : "New Layer";
    new NameInputModal(this.app, defaultName, (name) => {
      void this.createLayer(config, name);
    }).open();
  }

  private async createLayer(config: MapConfig, name: string): Promise<void> {
    const newLayerConfig: LayerConfig = {
      id: crypto.randomUUID(),
      name,
    };

    config.layers.push(newLayerConfig);
    await this.plugin.saveSettings();

    const loaded = await loadConfiguredLayers(
      this.app.vault.adapter,
      config.id,
      [newLayerConfig],
    );

    for (const layer of loaded) {
      this.layers.push(layer);
      this.addLayerToMap(layer);
    }

    new Notice(`Layer "${name}" added`);
  }

  private async loadAndDisplayLayers(config: MapConfig): Promise<void> {
    if (!this.map) return;

    this.layers = await loadConfiguredLayers(
      this.app.vault.adapter,
      config.id,
      config.layers,
    );

    for (const layer of this.layers) {
      this.addLayerToMap(layer);
    }
  }

  private addLayerToMap(layer: LoadedLayer): void {
    if (!this.map) return;

    const leafletLayer = L.geoJSON(layer.data, {
      pointToLayer: (feature, latlng) => {
        return this.createInteractiveMarker(
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
        if (
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon"
        ) {
          this.attachPolygonInteraction(
            feature as PolygonFeature,
            leafletFeature as L.Polygon,
            layer,
          );
        }
      },
    });
    leafletLayer.addTo(this.map);
    this.layerControl?.addOverlay(leafletLayer, layer.config.name);
    layer.leafletLayer = leafletLayer;
  }

  // --- Feature Interaction ---

  private buildSidebarState(
    featureType: "marker" | "polygon",
    props: MarkerProperties | PolygonProperties,
    feature: MapFeature,
    layer: LoadedLayer,
  ): SidebarState {
    return {
      featureType,
      properties: props,
      relations: this.resolveRelations(props),
      onOpenNote: (path: string) => {
        void this.app.workspace.openLinkText(path, "", false);
      },
      onReadNote: async (path: string) => {
        const file = this.app.vault.getFileByPath(`${path}.md`);
        if (!file) return null;
        return this.app.vault.cachedRead(file);
      },
      onRenderMarkdown: (markdown: string, el: HTMLElement) => {
        el.empty();
        void MarkdownRenderer.render(this.app, markdown, el, "", this);
      },
      onSearchTag: (tag: string) => {
        const search = (
          this.app as ObsidianApp
        ).internalPlugins?.getPluginById?.("global-search")?.instance;
        search?.openGlobalSearch(`tag:${tag}`);
      },
      onEdit: () => {
        this.editFeature(featureType, props, layer);
      },
      onDelete: () => {
        this.deleteFeature(props, layer);
      },
      onOpenLocalMap: props.localMapId
        ? () => void this.plugin.openMap(props.localMapId!)
        : undefined,
      onLinkLocalMap: !props.localMapId
        ? () => {
            this.openLinkLocalMapModal(feature, layer);
          }
        : undefined,
    };
  }

  private createInteractiveMarker(
    feature: MarkerFeature,
    latlng: L.LatLng,
    layer: LoadedLayer,
  ): L.Marker {
    const marker = createMarkerFromFeature(feature, latlng);

    marker.on("click", () => {
      this.selectFeature(
        this.buildSidebarState("marker", feature.properties, feature, layer),
        marker,
      );
    });

    marker.on("drag", () => {
      if (this.selectionRing && this.selectedLayer === marker) {
        this.selectionRing.setLatLng(marker.getLatLng());
      }
    });

    marker.on("dragend", () => {
      const newLatLng = marker.getLatLng();
      feature.geometry.coordinates = [newLatLng.lng, newLatLng.lat];
      void this.saveLayer(layer);
    });

    return marker;
  }

  private attachPolygonInteraction(
    feature: PolygonFeature,
    leafletPolygon: L.Polygon,
    layer: LoadedLayer,
  ): void {
    leafletPolygon.on("click", (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      this.selectFeature(
        this.buildSidebarState("polygon", feature.properties, feature, layer),
        leafletPolygon,
      );
    });
  }

  // --- Layer Options Helpers ---

  private getLayerOptions(): { id: string; name: string }[] {
    return this.layers.map((l) => ({ id: l.config.id, name: l.config.name }));
  }

  private resolveDefaultLayerId(
    layerOptions: { id: string; name: string }[],
  ): string {
    const config = this.getMapConfig();
    const defaultLayerId = config?.defaultLayerId ?? "";
    return defaultLayerId || (layerOptions[0]?.id ?? "");
  }

  // --- Add Marker ---

  private showAddMarkerMenu(e: L.LeafletMouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle("Add marker here");
      item.setIcon("map-pin");
      item.onClick(() => {
        this.openAddMarkerModal(e.latlng);
      });
    });
    menu.showAtPosition({
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
    });
  }

  private openAddMarkerModal(latlng: L.LatLng): void {
    const layerOptions = this.getLayerOptions();

    if (layerOptions.length === 0) {
      new Notice(
        "No layers configured. Use the 'Add Layer' button on the map.",
      );
      return;
    }

    const defaultLayerId = this.resolveDefaultLayerId(layerOptions);

    new FeatureModal(
      this.app,
      "marker",
      null,
      layerOptions,
      defaultLayerId,
      (properties, selectedLayerId) => {
        const feature: MarkerFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [latlng.lng, latlng.lat],
          },
          properties: properties as MarkerProperties,
        };

        const layer = this.layers.find((l) => l.config.id === selectedLayerId);
        if (!layer) {
          new Notice("Layer not found");
          return;
        }

        layer.data.features.push(feature);
        void this.saveLayer(layer);

        if (layer.leafletLayer && this.map) {
          const marker = this.createInteractiveMarker(feature, latlng, layer);
          layer.leafletLayer.addLayer(marker);
        }
      },
      this.mapId
        ? (featureId, cb) => {
            this.openLinkLocalMapForNew(featureId, cb);
          }
        : undefined,
      this.getAllFeatures(),
    ).open();
  }

  // --- Add Polygon ---

  private openAddPolygonModal(polygon: L.Polygon): void {
    const layerOptions = this.getLayerOptions();

    if (layerOptions.length === 0) {
      new Notice(
        "No layers configured. Use the 'Add Layer' button on the map.",
      );
      return;
    }

    const defaultLayerId = this.resolveDefaultLayerId(layerOptions);

    new FeatureModal(
      this.app,
      "polygon",
      null,
      layerOptions,
      defaultLayerId,
      (properties, selectedLayerId) => {
        const latLngs = polygon.getLatLngs() as L.LatLng[][];
        const coordinates: [number, number][][] = latLngs.map((ring) =>
          ring.map((ll) => [ll.lng, ll.lat] as [number, number]),
        );
        // Close the ring if not already closed
        for (const ring of coordinates) {
          if (
            ring.length > 0 &&
            (ring[0][0] !== ring[ring.length - 1][0] ||
              ring[0][1] !== ring[ring.length - 1][1])
          ) {
            ring.push(ring[0]);
          }
        }

        const feature: PolygonFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates,
          } as Polygon,
          properties: properties as PolygonProperties,
        };

        const layer = this.layers.find((l) => l.config.id === selectedLayerId);
        if (!layer) {
          new Notice("Layer not found");
          return;
        }

        layer.data.features.push(feature);
        void this.saveLayer(layer);
        this.refreshMapLayers();
      },
      this.mapId
        ? (featureId, cb) => {
            this.openLinkLocalMapForNew(featureId, cb);
          }
        : undefined,
      this.getAllFeatures(),
    ).open();
  }

  // --- Edit / Delete ---

  private editFeature(
    featureType: "marker" | "polygon",
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
  ): void {
    const layerOptions = this.getLayerOptions();
    new FeatureModal(
      this.app,
      featureType,
      properties,
      layerOptions,
      layer.config.id,
      (updatedProperties) => {
        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as { id: string }).id === properties.id,
        );
        if (featureIndex >= 0) {
          layer.data.features[featureIndex].properties = updatedProperties;
          void this.saveLayer(layer);
          this.refreshMapLayers();
        }
      },
      undefined,
      this.getAllFeatures(properties.id),
    ).open();
  }

  private deleteFeature(
    properties: MarkerProperties | PolygonProperties,
    layer: LoadedLayer,
  ): void {
    const modal = new DeleteConfirmModal(this.app, properties.name, () => {
      layer.data.features = layer.data.features.filter(
        (f) => (f.properties as { id: string }).id !== properties.id,
      );
      void this.saveLayer(layer);
      this.refreshMapLayers();
    });
    modal.open();
  }

  // --- Link Local Map ---

  private openLinkLocalMapForNew(
    featureId: string,
    cb: (mapId: string) => void,
  ): void {
    if (!this.mapId) return;
    const modal = new LinkLocalMapModal(
      this.app,
      this.mapId,
      featureId,
      this.plugin.settings.maps,
      (mapId, isNew, name, imagePath) => {
        if (isNew && name && imagePath) {
          this.plugin.settings.maps.push({
            id: mapId,
            name,
            mapImagePath: imagePath,
            layers: [],
            defaultLayerId: "",
            parentMapId: this.mapId ?? undefined,
            parentFeatureId: featureId,
          });
        } else if (!isNew) {
          const target = this.plugin.settings.maps.find((m) => m.id === mapId);
          if (target) {
            target.parentMapId = this.mapId ?? undefined;
            target.parentFeatureId = featureId;
          }
        }
        void this.plugin.saveSettings();
        cb(mapId);
      },
    );
    modal.open();
  }

  private openLinkLocalMapModal(feature: MapFeature, layer: LoadedLayer): void {
    if (!this.mapId) return;

    const modal = new LinkLocalMapModal(
      this.app,
      this.mapId,
      (feature.properties as { id: string }).id,
      this.plugin.settings.maps,
      (mapId, isNew, name, imagePath) => {
        if (isNew && name && imagePath) {
          const newMap = {
            id: mapId,
            name,
            mapImagePath: imagePath,
            layers: [],
            defaultLayerId: "",
            parentMapId: this.mapId ?? undefined,
            parentFeatureId: (feature.properties as { id: string }).id,
          };
          this.plugin.settings.maps.push(newMap);
        } else if (!isNew) {
          const target = this.plugin.settings.maps.find((m) => m.id === mapId);
          if (target) {
            target.parentMapId = this.mapId ?? undefined;
            target.parentFeatureId = (feature.properties as { id: string }).id;
          }
        }

        const featureIndex = layer.data.features.findIndex(
          (f) =>
            (f.properties as { id: string }).id ===
            (feature.properties as { id: string }).id,
        );
        if (featureIndex >= 0) {
          (
            layer.data.features[featureIndex].properties as {
              localMapId?: string;
            }
          ).localMapId = mapId;
        }

        void this.plugin.saveSettings();
        void this.saveLayer(layer);
        this.refreshMapLayers();
      },
    );
    modal.open();
  }

  // --- Utilities ---

  private getAllFeatures(excludeId?: string): { id: string; name: string }[] {
    const features: { id: string; name: string }[] = [];
    for (const layer of this.layers) {
      for (const feature of layer.data.features) {
        const props = feature.properties as { id: string; name: string };
        if (props.id !== excludeId) {
          features.push({ id: props.id, name: props.name });
        }
      }
    }
    return features;
  }

  private findLeafletLayerById(featureId: string): L.Layer | null {
    for (const loadedLayer of this.layers) {
      if (!loadedLayer.leafletLayer) continue;
      const layers: L.Layer[] = [];
      loadedLayer.leafletLayer.eachLayer((layer) => layers.push(layer));
      const found = layers.find((layer) => {
        const f = (layer as unknown as { feature?: MapFeature }).feature;
        return (f?.properties as { id?: string } | undefined)?.id === featureId;
      });
      if (found !== undefined) return found;
    }
    return null;
  }

  private resolveRelations(
    props: MarkerProperties | PolygonProperties,
  ): { featureId: string; featureName: string; label: string }[] {
    return (props.relations ?? []).map((r) => ({
      featureId: r.featureId,
      featureName:
        this.getAllFeatures().find((f) => f.id === r.featureId)?.name ??
        r.featureId,
      label: r.label,
    }));
  }

  private getFeatureLatLng(featureId: string): L.LatLng | null {
    const layer = this.findLeafletLayerById(featureId);
    if (!layer) return null;
    if (layer instanceof L.Marker) return layer.getLatLng();
    if (layer instanceof L.Polygon) return layer.getBounds().getCenter();
    return null;
  }

  private getSelectedFeatureLatLng(leafletLayer: L.Layer): L.LatLng | null {
    if (leafletLayer instanceof L.Marker) return leafletLayer.getLatLng();
    if (leafletLayer instanceof L.Polygon)
      return leafletLayer.getBounds().getCenter();
    return null;
  }

  private findIncomingRelations(
    featureId: string,
  ): { featureId: string; featureName: string; label: string }[] {
    const incoming: { featureId: string; featureName: string; label: string }[] =
      [];
    for (const layer of this.layers) {
      for (const feature of layer.data.features) {
        const props = feature.properties as MarkerProperties | PolygonProperties;
        if (props.id === featureId) continue;
        for (const rel of props.relations ?? []) {
          if (rel.featureId === featureId) {
            incoming.push({
              featureId: props.id,
              featureName: props.name,
              label: rel.label,
            });
          }
        }
      }
    }
    return incoming;
  }

  private drawRelationArrows(
    selectedId: string,
    leafletLayer: L.Layer,
    outgoing: { featureId: string; label: string }[],
  ): void {
    if (!this.map) return;

    const from = this.getSelectedFeatureLatLng(leafletLayer);
    if (!from) return;

    const incoming = this.findIncomingRelations(selectedId);

    // Draw outgoing arrows (selected -> related)
    for (const rel of outgoing) {
      const to = this.getFeatureLatLng(rel.featureId);
      if (!to) continue;
      this.addCurvedArrow(from, to, rel.label, "#f59e0b", true);
    }

    // Draw incoming arrows (related -> selected)
    for (const rel of incoming) {
      const relFrom = this.getFeatureLatLng(rel.featureId);
      if (!relFrom) continue;
      this.addCurvedArrow(relFrom, from, rel.label, "#8b5cf6", true);
    }
  }

  private addCurvedArrow(
    from: L.LatLng,
    to: L.LatLng,
    label: string,
    color: string,
    showArrowhead: boolean,
  ): void {
    if (!this.map) return;

    // Compute curved path as quadratic bezier approximation
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;

    // Offset the control point perpendicular to the line
    const offset = 0.2;
    const ctrlLat = midLat + dLng * offset;
    const ctrlLng = midLng - dLat * offset;

    // Approximate bezier with polyline points
    const points: L.LatLng[] = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const lat = u * u * from.lat + 2 * u * t * ctrlLat + t * t * to.lat;
      const lng = u * u * from.lng + 2 * u * t * ctrlLng + t * t * to.lng;
      points.push(L.latLng(lat, lng));
    }

    const line = L.polyline(points, {
      color,
      weight: 2.5,
      opacity: 0.8,
      dashArray: "8 4",
      interactive: false,
      className: "fantasy-map-relation-arrow",
    }).addTo(this.map);
    this.relationArrows.push(line);

    // Arrowhead at ~85% along the curve (near the target but not on it)
    if (showArrowhead) {
      const arrowT = 0.85;
      const u2 = 1 - arrowT;
      const arrowLat =
        u2 * u2 * from.lat + 2 * u2 * arrowT * ctrlLat + arrowT * arrowT * to.lat;
      const arrowLng =
        u2 * u2 * from.lng + 2 * u2 * arrowT * ctrlLng + arrowT * arrowT * to.lng;

      // Tangent at arrowT for direction
      const tgLat =
        2 * (1 - arrowT) * (ctrlLat - from.lat) +
        2 * arrowT * (to.lat - ctrlLat);
      const tgLng =
        2 * (1 - arrowT) * (ctrlLng - from.lng) +
        2 * arrowT * (to.lng - ctrlLng);
      const angle = Math.atan2(tgLng, tgLat);

      const arrowSize = Math.sqrt(dLat * dLat + dLng * dLng) * 0.04;
      const spread = Math.PI / 6;

      const tip = L.latLng(arrowLat, arrowLng);
      const left = L.latLng(
        arrowLat - arrowSize * Math.cos(angle - spread),
        arrowLng - arrowSize * Math.sin(angle - spread),
      );
      const right = L.latLng(
        arrowLat - arrowSize * Math.cos(angle + spread),
        arrowLng - arrowSize * Math.sin(angle + spread),
      );

      const arrowhead = L.polygon([tip, left, right], {
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1,
        interactive: false,
        className: "fantasy-map-relation-arrowhead",
      }).addTo(this.map);
      this.relationArrows.push(arrowhead);
    }

    // Label at the midpoint of the curve
    const labelT = 0.5;
    const uL = 1 - labelT;
    const labelLat =
      uL * uL * from.lat + 2 * uL * labelT * ctrlLat + labelT * labelT * to.lat;
    const labelLng =
      uL * uL * from.lng + 2 * uL * labelT * ctrlLng + labelT * labelT * to.lng;

    const tooltip = L.tooltip({
      permanent: true,
      direction: "center",
      className: "fantasy-map-relation-label",
      interactive: false,
    })
      .setLatLng(L.latLng(labelLat, labelLng))
      .setContent(label)
      .addTo(this.map);
    this.relationArrows.push(tooltip);
  }

  private clearRelationArrows(): void {
    for (const layer of this.relationArrows) {
      this.map?.removeLayer(layer);
    }
    this.relationArrows = [];
  }

  private selectFeature(
    state: SidebarState | null,
    leafletLayer?: L.Layer,
  ): void {
    // Clear previous selection highlight
    this.clearSelection();

    this.updateSidebar?.(state);
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle("fantasy-map-sidebar--hidden", !state);
    }

    if (state && leafletLayer && this.map) {
      this.selectedLayer = leafletLayer;

      if (leafletLayer instanceof L.Marker) {
        // Add a pulsing ring around the selected marker
        const latlng = leafletLayer.getLatLng();
        this.selectionRing = L.circleMarker(latlng, {
          radius: 20,
          weight: 3,
          color: "var(--text-accent)",
          fillColor: "var(--text-accent)",
          fillOpacity: 0.15,
          className: "fantasy-map-selection-ring",
          interactive: false,
        }).addTo(this.map);
        // Add selected class to the marker element
        const el = leafletLayer.getElement();
        el?.classList.add("fantasy-map-marker--selected");
      } else if (leafletLayer instanceof L.Polygon) {
        // Highlight the polygon with accent color border and brighter fill
        const feature = (
          leafletLayer as unknown as { feature?: PolygonFeature }
        ).feature;
        const fillColor = feature?.properties.color ?? "#3388ff";
        leafletLayer.setStyle({
          weight: 4,
          color: "var(--text-accent)",
          fillColor,
          fillOpacity: 0.45,
          className: "fantasy-map-polygon--selected",
        });
      }

      // Highlight related features
      for (const rel of state.relations ?? []) {
        const relatedLayer = this.findLeafletLayerById(rel.featureId);
        if (!relatedLayer) continue;

        let latlng: L.LatLng;
        if (relatedLayer instanceof L.Marker) {
          latlng = relatedLayer.getLatLng();
        } else if (relatedLayer instanceof L.Polygon) {
          latlng = relatedLayer.getBounds().getCenter();
        } else {
          continue;
        }

        const ring = L.circleMarker(latlng, {
          radius: 18,
          weight: 2,
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.12,
          dashArray: "5 4",
          interactive: false,
          className: "fantasy-map-relation-ring",
        }).addTo(this.map);
        this.relationHighlights.push(ring);
      }

      // Also highlight features with incoming relations
      const featureId = (state.properties as { id: string }).id;
      const incoming = this.findIncomingRelations(featureId);
      for (const rel of incoming) {
        const relatedLayer = this.findLeafletLayerById(rel.featureId);
        if (!relatedLayer) continue;

        let latlng: L.LatLng;
        if (relatedLayer instanceof L.Marker) {
          latlng = relatedLayer.getLatLng();
        } else if (relatedLayer instanceof L.Polygon) {
          latlng = relatedLayer.getBounds().getCenter();
        } else {
          continue;
        }

        const ring = L.circleMarker(latlng, {
          radius: 18,
          weight: 2,
          color: "#8b5cf6",
          fillColor: "#8b5cf6",
          fillOpacity: 0.12,
          dashArray: "5 4",
          interactive: false,
          className: "fantasy-map-relation-ring",
        }).addTo(this.map);
        this.relationHighlights.push(ring);
      }

      // Draw curved arrows for outgoing and incoming relations
      this.drawRelationArrows(
        featureId,
        leafletLayer,
        (state.relations ?? []).map((r) => ({
          featureId: r.featureId,
          label: r.label,
        })),
      );
    }
  }

  private clearSelection(): void {
    this.clearRelationArrows();

    for (const ring of this.relationHighlights) {
      this.map?.removeLayer(ring);
    }
    this.relationHighlights = [];

    if (this.selectionRing && this.map) {
      this.map.removeLayer(this.selectionRing);
      this.selectionRing = null;
    }
    if (this.selectedLayer) {
      if (this.selectedLayer instanceof L.Marker) {
        const el = this.selectedLayer.getElement();
        el?.classList.remove("fantasy-map-marker--selected");
      } else if (this.selectedLayer instanceof L.Polygon) {
        // Restore original polygon style
        const feature = (
          this.selectedLayer as unknown as { feature?: PolygonFeature }
        ).feature;
        const color = feature?.properties.color ?? "#3388ff";
        this.selectedLayer.setStyle({
          weight: 2,
          dashArray: undefined,
          className: "",
        });
        this.selectedLayer.setStyle({ color, fillColor: color });
      }
      this.selectedLayer = null;
    }
  }

  private async saveLayer(layer: LoadedLayer): Promise<void> {
    const json = JSON.stringify(layer.data, null, 2);
    await this.app.vault.adapter.write(layer.filePath, json);
  }

  private refreshMapLayers(): void {
    if (!this.map) return;

    this.selectFeature(null);

    for (const layer of this.layers) {
      if (layer.leafletLayer) {
        layer.leafletLayer.clearLayers();
        layer.leafletLayer.addData(layer.data);
      }
    }
  }
}
