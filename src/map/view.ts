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
import { SelectionManager } from "./selection";
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
  private selection: SelectionManager | null = null;

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
    this.selection?.clear();
    this.selection = null;
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
    this.selection = new SelectionManager(this.map);

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
      this.selection?.updateDragPosition(marker);
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

  private selectFeature(
    state: SidebarState | null,
    leafletLayer?: L.Layer,
  ): void {
    this.selection?.clear();

    this.updateSidebar?.(state);
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle("fantasy-map-sidebar--hidden", !state);
    }

    if (state && leafletLayer) {
      this.selection?.select(leafletLayer, state, this.layers);
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
