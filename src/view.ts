import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon } from "obsidian";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { mount, unmount } from "svelte";
import type { Polygon } from "geojson";
import type FantasyMapPlugin from "./main";
import type {
  LoadedLayer,
  MapConfig,
  LayerConfig,
  MapFeature,
  MarkerFeature,
  PolygonFeature,
  MarkerProperties,
  PolygonProperties,
} from "./types";
import { loadConfiguredLayers } from "./layers";
import { createMarkerFromFeature, fixLeafletDefaultIcons } from "./markers";
import {
  MarkerModal,
  DeleteConfirmModal,
  PolygonModal,
  SetScaleModal,
  LinkLocalMapModal,
  NameInputModal,
} from "./modals";
import { MAP_CONFIG, GEOMAN_CONFIG } from "./config";
import { pixelDistance, pickNiceDistance } from "./scales";
import MarkerSidebar from "./components/MarkerSidebar.svelte";

interface SidebarState {
  featureType: "marker" | "polygon";
  properties: MarkerProperties | PolygonProperties;
  onOpenNote: (path: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenLocalMap?: () => void;
  onLinkLocalMap?: () => void;
}

export const FANTASY_MAP_VIEW = "fantasy-map-view";

type CalibrationMode = "off" | "point1" | "point2";
type MeasureMode = "off" | "point1" | "point2";

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

  // Scale calibration state
  private calMode: CalibrationMode = "off";
  private calPoint1: L.LatLng | null = null;
  private calTempLayers: L.Layer[] = [];
  private scaleBarControl: L.Control | null = null;
  private updateScaleBar: (() => void) | null = null;

  // Measure distance state
  private measureMode: MeasureMode = "off";
  private measurePoint1: L.LatLng | null = null;
  private measureTempLayers: L.Layer[] = [];
  private measureResultPopup: L.Popup | null = null;

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
    this.sidebarComponent = mount(MarkerSidebar, {
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
    this.calMode = "off";
    this.calPoint1 = null;
    this.calTempLayers = [];
    this.scaleBarControl = null;
    this.updateScaleBar = null;
    this.measureMode = "off";
    this.measurePoint1 = null;
    this.measureTempLayers = [];
    this.measureResultPopup = null;
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

    // Layer control for toggling overlay visibility
    this.layerControl = L.control
      .layers({}, {}, { position: "topright" })
      .addTo(this.map);

    // Initialize Geoman controls
    this.map.pm.addControls(GEOMAN_CONFIG);

    // Set Scale button
    this.addSetScaleControl();

    // Measure Distance button
    this.addMeasureControl();

    // Add Layer button
    this.addAddLayerControl(config);

    // Parent map navigation (for local maps)
    this.renderParentNavigation(config);

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

    // Click on map background deselects the current feature
    // Also handles calibration and measure clicks
    this.map.on("click", (e: L.LeafletMouseEvent) => {
      if (this.calMode !== "off") {
        this.handleCalibrationClick(e.latlng);
        return;
      }
      if (this.measureMode !== "off") {
        this.handleMeasureClick(e.latlng);
        return;
      }
      this.selectFeature(null);
    });

    // Right-click to add a marker
    this.map.on("contextmenu", (e: L.LeafletMouseEvent) => {
      if (this.calMode !== "off") return;
      if (this.measureMode !== "off") return;
      this.showAddMarkerMenu(e);
    });
  }

  // --- Scale Calibration ---

  private addSetScaleControl(): void {
    if (!this.map) return;

    const SetScaleControl = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create(
          "button",
          "leaflet-bar fantasy-map-toolbar-btn fantasy-map-scale-btn",
        );
        btn.title = "Set Scale";
        setIcon(btn, "pencil-ruler");
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          this.startCalibration();
        });
        return btn;
      },
    });

    new SetScaleControl({ position: "topright" }).addTo(this.map);
  }

  private addAddLayerControl(config: MapConfig): void {
    if (!this.map) return;

    const AddLayerControl = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create(
          "button",
          "leaflet-bar fantasy-map-toolbar-btn fantasy-map-add-layer-btn",
        );
        btn.title = "Add Layer";
        setIcon(btn, "layers");
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          this.promptAddLayer(config);
        });
        return btn;
      },
    });

    new AddLayerControl({ position: "topright" }).addTo(this.map);
  }

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

  private startCalibration(): void {
    if (!this.map) return;
    this.calMode = "point1";
    this.clearCalTempLayers();
    this.map.getContainer().classList.add("is-calibrating");
    new Notice("Click the first calibration point on the map");
  }

  private handleCalibrationClick(latlng: L.LatLng): void {
    if (!this.map) return;

    if (this.calMode === "point1") {
      this.calPoint1 = latlng;
      const circle = L.circleMarker(latlng, {
        radius: 6,
        color: "#e74c3c",
        fillColor: "#e74c3c",
        fillOpacity: 1,
      }).addTo(this.map);
      this.calTempLayers.push(circle);
      this.calMode = "point2";
      new Notice("Click the second calibration point on the map");
    } else if (this.calMode === "point2" && this.calPoint1) {
      const p1 = this.calPoint1;
      const circle2 = L.circleMarker(latlng, {
        radius: 6,
        color: "#e74c3c",
        fillColor: "#e74c3c",
        fillOpacity: 1,
      }).addTo(this.map);
      this.calTempLayers.push(circle2);

      const line = L.polyline([p1, latlng], {
        color: "#e74c3c",
        dashArray: "6,4",
      }).addTo(this.map);
      this.calTempLayers.push(line);

      this.calMode = "off";
      this.map.getContainer().classList.remove("is-calibrating");

      const pxDist = pixelDistance([p1.lat, p1.lng], [latlng.lat, latlng.lng]);

      new SetScaleModal(this.app, (realDistance, unit) => {
        this.clearCalTempLayers();

        const config = this.getMapConfig();
        if (!config) return;

        config.scale = {
          point1: [p1.lat, p1.lng],
          point2: [latlng.lat, latlng.lng],
          pixelDistance: pxDist,
          realDistance,
          unit,
        };

        void this.plugin.saveSettings().then(() => {
          this.renderScaleBar(config);
          new Notice(
            `Scale set: ${realDistance.toString()} ${unit} between the two points`,
          );
        });
      }).open();
    }
  }

  private clearCalTempLayers(): void {
    for (const layer of this.calTempLayers) {
      this.map?.removeLayer(layer);
    }
    this.calTempLayers = [];
  }

  // --- Measure Distance ---

  private addMeasureControl(): void {
    if (!this.map) return;

    const MeasureControl = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create(
          "button",
          "leaflet-bar fantasy-map-toolbar-btn fantasy-map-measure-btn",
        );
        btn.title = "Measure Distance";
        setIcon(btn, "ruler");
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          this.startMeasure();
        });
        return btn;
      },
    });

    new MeasureControl({ position: "topright" }).addTo(this.map);
  }

  private startMeasure(): void {
    if (!this.map) return;
    this.clearMeasureLayers();
    this.measureMode = "point1";
    this.map.getContainer().classList.add("is-measuring");
    new Notice("Click the first point to measure from");
  }

  private handleMeasureClick(latlng: L.LatLng): void {
    if (!this.map) return;

    if (this.measureMode === "point1") {
      this.measurePoint1 = latlng;
      const dot = L.circleMarker(latlng, {
        radius: 6,
        color: "#3498db",
        fillColor: "#3498db",
        fillOpacity: 1,
      }).addTo(this.map);
      this.measureTempLayers.push(dot);
      this.measureMode = "point2";
      new Notice("Click the second point to measure to");
    } else if (this.measureMode === "point2" && this.measurePoint1) {
      const p1 = this.measurePoint1;

      const dot2 = L.circleMarker(latlng, {
        radius: 6,
        color: "#3498db",
        fillColor: "#3498db",
        fillOpacity: 1,
      }).addTo(this.map);
      this.measureTempLayers.push(dot2);

      const line = L.polyline([p1, latlng], {
        color: "#3498db",
        dashArray: "6,4",
        weight: 2,
      }).addTo(this.map);
      this.measureTempLayers.push(line);

      this.measureMode = "off";
      this.map.getContainer().classList.remove("is-measuring");

      const pxDist = pixelDistance([p1.lat, p1.lng], [latlng.lat, latlng.lng]);

      const config = this.getMapConfig();
      let label: string;
      if (config?.scale) {
        const scale = config.scale;
        const unitsPerPixel = scale.realDistance / scale.pixelDistance;
        const realDist = pxDist * unitsPerPixel;
        const rounded =
          realDist >= 10
            ? Math.round(realDist).toString()
            : realDist.toFixed(1);
        label = `${rounded} ${scale.unit}`;
      } else {
        label = `${Math.round(pxDist).toString()} px (no scale set)`;
      }

      const midLat = (p1.lat + latlng.lat) / 2;
      const midLng = (p1.lng + latlng.lng) / 2;
      this.measureResultPopup = L.popup({
        closeButton: true,
        className: "fantasy-map-measure-popup",
      })
        .setLatLng([midLat, midLng])
        .setContent(`<strong>${label}</strong>`)
        .openOn(this.map);

      this.measureResultPopup.on("remove", () => {
        this.clearMeasureLayers();
      });
    }
  }

  private clearMeasureLayers(): void {
    for (const layer of this.measureTempLayers) {
      this.map?.removeLayer(layer);
    }
    this.measureTempLayers = [];
    if (this.measureResultPopup) {
      this.map?.closePopup(this.measureResultPopup);
      this.measureResultPopup = null;
    }
    this.measurePoint1 = null;
    this.map?.getContainer().classList.remove("is-measuring");
  }

  private renderScaleBar(config: MapConfig): void {
    if (!this.map || !config.scale) return;

    // Remove existing scale bar and zoom listener
    if (this.scaleBarControl) {
      this.scaleBarControl.remove();
      this.scaleBarControl = null;
    }
    if (this.updateScaleBar) {
      this.map.off("zoomend", this.updateScaleBar);
      this.updateScaleBar = null;
    }

    const scale = config.scale;
    const map = this.map;

    const scaleBarDiv = L.DomUtil.create("div", "fantasy-map-scale-bar");

    const updateContent = (): void => {
      const p1 = L.latLng(scale.point1[0], scale.point1[1]);
      const p2 = L.latLng(scale.point2[0], scale.point2[1]);
      const screenPx = map.latLngToContainerPoint(p1).distanceTo(map.latLngToContainerPoint(p2));
      const pixelsPerUnit = screenPx / scale.realDistance;
      const { distance, barPixels } = pickNiceDistance(pixelsPerUnit, 200);
      // eslint-disable-next-line @microsoft/sdl/no-inner-html
      scaleBarDiv.innerHTML = `<div class="scale-bar-title">Scale</div><div class="scale-bar-line" style="width:${Math.round(barPixels).toString()}px"></div><div class="scale-bar-label">${distance.toString()} ${scale.unit}</div>`;
    };

    updateContent();

    const ScaleBarControl = L.Control.extend({
      onAdd: () => scaleBarDiv,
    });

    this.scaleBarControl = new ScaleBarControl({
      position: "bottomleft",
    }).addTo(this.map);

    this.updateScaleBar = updateContent;
    this.map.on("zoomend", this.updateScaleBar);
  }

  // --- Parent Navigation (Local Maps) ---

  private renderParentNavigation(config: MapConfig): void {
    if (!this.map || !config.parentMapId) return;

    const parentConfig = this.plugin.settings.maps.find(
      (m) => m.id === config.parentMapId,
    );
    const parentName = parentConfig?.name ?? "Parent Map";

    const BackControl = L.Control.extend({
      onAdd: () => {
        const btn = L.DomUtil.create(
          "button",
          "leaflet-bar fantasy-map-back-btn",
        );
        btn.textContent = `↩ ${parentName}`;
        btn.title = `Back to ${parentName}`;
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          void this.plugin.openMap(config.parentMapId!);
        });
        return btn;
      },
    });

    new BackControl({ position: "topleft" }).addTo(this.map);
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

  private createInteractiveMarker(
    feature: MarkerFeature,
    latlng: L.LatLng,
    layer: LoadedLayer,
  ): L.Marker {
    const marker = createMarkerFromFeature(feature, latlng);

    marker.on("click", () => {
      const props = feature.properties;
      this.selectFeature({
        featureType: "marker",
        properties: props,
        onOpenNote: (path: string) => {
          void this.app.workspace.openLinkText(path, "", false);
        },
        onEdit: () => {
          this.editMarker(props, layer);
        },
        onDelete: () => {
          this.deleteFeature(props, layer);
        },
        onOpenLocalMap: () =>
          props.localMapId
            ? void this.plugin.openMap(props.localMapId)
            : undefined,
        onLinkLocalMap: !props.localMapId
          ? () => {
              this.openLinkLocalMapModal(feature as MapFeature, layer);
            }
          : undefined,
      });
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
      const props = feature.properties;
      this.selectFeature({
        featureType: "polygon",
        properties: props,
        onOpenNote: (path: string) => {
          void this.app.workspace.openLinkText(path, "", false);
        },
        onEdit: () => {
          this.editPolygon(props, layer);
        },
        onDelete: () => {
          this.deleteFeature(props, layer);
        },
        onOpenLocalMap: () =>
          props.localMapId
            ? void this.plugin.openMap(props.localMapId)
            : undefined,

        onLinkLocalMap: !props.localMapId
          ? () => {
              this.openLinkLocalMapModal(feature as MapFeature, layer);
            }
          : undefined,
      });
    });
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
      new Notice(
        "No layers configured. Use the 'Add Layer' button on the map.",
      );
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
        const feature: MarkerFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [latlng.lng, latlng.lat],
          },
          properties,
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
    );
    modal.open();
  }

  // --- Add Polygon ---

  private openAddPolygonModal(polygon: L.Polygon): void {
    const config = this.getMapConfig();
    const layerOptions = this.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
    }));

    if (layerOptions.length === 0) {
      new Notice(
        "No layers configured. Use the 'Add Layer' button on the map.",
      );
      return;
    }

    let defaultLayerId = config?.defaultLayerId ?? "";
    if (!defaultLayerId && layerOptions.length > 0) {
      defaultLayerId = layerOptions[0].id;
    }

    const modal = new PolygonModal(
      this.app,
      null,
      layerOptions,
      defaultLayerId,
      (properties: PolygonProperties, selectedLayerId: string) => {
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
          properties,
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
          (f) => (f.properties as MarkerProperties).id === properties.id,
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

  // --- Edit Polygon ---

  private editPolygon(properties: PolygonProperties, layer: LoadedLayer): void {
    const layerOptions = this.layers.map((l) => ({
      id: l.config.id,
      name: l.config.name,
    }));

    const modal = new PolygonModal(
      this.app,
      properties,
      layerOptions,
      layer.config.id,
      (updatedProperties: PolygonProperties) => {
        const featureIndex = layer.data.features.findIndex(
          (f) => (f.properties as PolygonProperties).id === properties.id,
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

  // --- Delete Feature ---

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
          // Link existing map: set its parentMapId
          const target = this.plugin.settings.maps.find((m) => m.id === mapId);
          if (target) {
            target.parentMapId = this.mapId ?? undefined;
            target.parentFeatureId = (feature.properties as { id: string }).id;
          }
        }

        // Update the feature's localMapId
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

  private selectFeature(state: SidebarState | null): void {
    this.updateSidebar?.(state);
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle("fantasy-map-sidebar--hidden", !state);
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
