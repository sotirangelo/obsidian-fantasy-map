import { ItemView, WorkspaceLeaf, Menu, Notice } from "obsidian";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import type { Point } from "geojson";
import type FantasyMapPlugin from "./main";
import type {
  LoadedLayer,
  MapConfig,
  MapFeature,
  MarkerProperties,
} from "./types";
import { loadConfiguredLayers } from "./layers";
import { createMarkerFromFeature, fixLeafletDefaultIcons } from "./markers";
import { MarkerModal, DeleteConfirmModal } from "./modals";
import { MAP_CONFIG, GEOMAN_CONFIG } from "./config";

export const FANTASY_MAP_VIEW = "fantasy-map-view";

export class FantasyMapView extends ItemView {
  plugin: FantasyMapPlugin;
  map: L.Map | null = null;
  layers: LoadedLayer[] = [];
  mapContainerEl: HTMLDivElement | null = null;
  mapId: string | null = null;
  private blobUrl: string | null = null;
  private layerControl: L.Control.Layers | null = null;

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
        text: "No map configured. Go to Settings > Fantasy Map to add a map.",
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

    this.mapContainerEl = container.createDiv({ cls: "fantasy-map-container" });

    try {
      const imageUrl = await this.getImageUrl(config.mapImagePath);
      this.blobUrl = imageUrl;
      const dimensions = await this.getImageDimensions(imageUrl);
      this.initializeMap(imageUrl, dimensions);
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
    this.layers = [];
    this.layerControl = null;
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
  ): void {
    if (!this.mapContainerEl) return;

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [dimensions.height, dimensions.width],
    ];

    this.map = L.map(this.mapContainerEl, {
      crs: L.CRS.Simple,
      ...MAP_CONFIG,
    });

    L.imageOverlay(imageUrl, bounds).addTo(this.map);
    this.map.fitBounds(bounds);

    // Layer control for toggling overlay visibility
    this.layerControl = L.control.layers({}, {}).addTo(this.map);

    // Initialize Geoman controls - only marker drawing enabled for now
    this.map.pm.addControls(GEOMAN_CONFIG);

    // When a marker is created via the Geoman toolbar
    this.map.on("pm:create", (e: { shape: string; layer: L.Layer }) => {
      if (e.shape === "Marker") {
        const marker = e.layer as L.Marker;
        const latlng = marker.getLatLng();

        // Remove the temporary Geoman marker - we'll create our own
        this.map?.removeLayer(marker);

        this.openAddMarkerModal(latlng);
      }
    });

    // Also support right-click to add a marker
    this.map.on("contextmenu", (e: L.LeafletMouseEvent) => {
      this.showAddMarkerMenu(e);
    });
  }

  // --- Layer Management ---

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

    const leafletLayer = L.geoJSON<MarkerProperties, Point>(layer.data, {
      pointToLayer: (_feature, latlng) => {
        return this.createInteractiveMarker(_feature, latlng, layer);
      },
    });
    leafletLayer.addTo(this.map);
    this.layerControl?.addOverlay(leafletLayer, layer.config.name);
    layer.leafletLayer = leafletLayer;
  }

  private createInteractiveMarker(
    feature: MapFeature,
    latlng: L.LatLng,
    layer: LoadedLayer,
  ): L.Marker {
    const marker = createMarkerFromFeature(feature, latlng);

    const popupContent = this.buildPopupContent(feature.properties, layer);
    marker.bindPopup(popupContent);

    // Save coordinates on drag end
    marker.on("dragend", () => {
      const newLatLng = marker.getLatLng();
      feature.geometry.coordinates = [newLatLng.lng, newLatLng.lat];
      void this.saveLayer(layer);
    });

    return marker;
  }

  // --- Popup Content ---

  private buildPopupContent(
    properties: MarkerProperties,
    layer: LoadedLayer,
  ): HTMLDivElement {
    const div = document.createElement("div");
    div.addClass("fantasy-map-popup");

    const title = div.createEl("h4", { text: properties.name });
    if (properties.icon) {
      title.prepend(document.createTextNode(properties.icon + " "));
    }

    if (properties.description) {
      div.createEl("p", {
        text: properties.description,
        cls: "popup-description",
      });
    }

    if (properties.note) {
      const link = div.createEl("a", {
        text: `Open: ${properties.note}`,
        cls: "popup-note-link",
        href: "#",
      });
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        void this.app.workspace.openLinkText(properties.note, "", false);
      });
    }

    const buttons = div.createDiv({ cls: "popup-buttons" });

    const editBtn = buttons.createEl("button", {
      text: "Edit",
      cls: "popup-btn",
    });
    editBtn.addEventListener("click", () => {
      this.map?.closePopup();
      this.editMarker(properties, layer);
    });

    const deleteBtn = buttons.createEl("button", {
      text: "Delete",
      cls: "popup-btn popup-btn-danger",
    });
    deleteBtn.addEventListener("click", () => {
      this.map?.closePopup();
      this.deleteMarker(properties, layer);
    });

    return div;
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
    const config = this.getMapConfig();
    const layerOptions = this.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
    }));

    if (layerOptions.length === 0) {
      new Notice("No layers configured. Add a layer in Fantasy Map settings.");
      return;
    }

    let defaultLayerId = config?.defaultLayerId ?? "";
    if (!defaultLayerId && layerOptions.length > 0) {
      defaultLayerId = layerOptions[0].id;
    }

    const modal = new MarkerModal(
      this.app,
      null,
      layerOptions,
      defaultLayerId,
      (properties: MarkerProperties, selectedLayerId: string) => {
        const feature: MapFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [latlng.lng, latlng.lat],
          },
          properties,
        };

        const layer = this.layers.find((l) => l.config.id === selectedLayerId);
        if (!layer) {
          new Notice(`Layer not found`);
          return;
        }

        layer.data.features.push(feature);
        void this.saveLayer(layer);

        // Add the marker to the existing Leaflet layer
        if (layer.leafletLayer && this.map) {
          const marker = this.createInteractiveMarker(feature, latlng, layer);
          layer.leafletLayer.addLayer(marker);
        }
      },
    );
    modal.open();
  }

  // --- Edit Marker ---

  private editMarker(properties: MarkerProperties, layer: LoadedLayer): void {
    const layerOptions = this.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
    }));

    const modal = new MarkerModal(
      this.app,
      properties,
      layerOptions,
      layer.config.id,
      (updatedProperties: MarkerProperties) => {
        const featureIndex = layer.data.features.findIndex(
          (f) => f.properties.id === properties.id,
        );
        if (featureIndex >= 0) {
          layer.data.features[featureIndex].properties = updatedProperties;
          void this.saveLayer(layer);
          this.refreshMapLayers();
        }
      },
    );
    modal.open();
  }

  // --- Delete Marker ---

  private deleteMarker(properties: MarkerProperties, layer: LoadedLayer): void {
    const modal = new DeleteConfirmModal(this.app, properties.name, () => {
      layer.data.features = layer.data.features.filter(
        (f) => f.properties.id !== properties.id,
      );
      void this.saveLayer(layer);
      this.refreshMapLayers();
    });
    modal.open();
  }

  // --- Utilities ---

  private async saveLayer(layer: LoadedLayer): Promise<void> {
    const json = JSON.stringify(layer.data, null, 2);
    await this.app.vault.adapter.write(layer.filePath, json);
  }

  private refreshMapLayers(): void {
    if (!this.map) return;

    for (const layer of this.layers) {
      if (layer.leafletLayer) {
        layer.leafletLayer.clearLayers();
        layer.leafletLayer.addData(layer.data);
      }
    }
  }
}
