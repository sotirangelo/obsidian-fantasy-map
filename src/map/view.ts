import { ItemView, WorkspaceLeaf, Notice, Menu } from "obsidian";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { mount, unmount } from "svelte";
import type FantasyMapPlugin from "../main";
import type {
  LayerConfig,
  LoadedLayer,
  MapConfig,
  SidebarState,
} from "../types";
import { MAP_CONFIG } from "../config";
import { pickNiceDistance } from "./scales";
import { createScaleBar } from "./controls";
import { CalibrationHandler } from "./calibration";
import { MeasureHandler } from "./measure";
import { SelectionManager } from "./selection";
import Sidebar from "../components/Sidebar.svelte";
import MapControls from "../components/MapControls.svelte";
import { ImageSuggestModal, renderCreateMapForm } from "../modals/create-map";
import { loadImageAsBlobUrl, getImageDimensions } from "./image";
import type { MapContext } from "./context";
import { LocalMapLinker } from "./local-map";
import { FeatureController } from "./feature-controller";
import { SidebarStateBuilder } from "./sidebar-state";
import { LayerManager } from "./layer-management";

export const FANTASY_MAP_VIEW = "fantasy-map-view";

export class FantasyMapView extends ItemView {
  plugin: FantasyMapPlugin;
  mapId: string | null = null;
  mapContainerEl: HTMLDivElement | null = null;

  private map: L.Map | null = null;
  private layers: LoadedLayer[] = [];
  private selection: SelectionManager | null = null;
  private calibration: CalibrationHandler | null = null;
  private measure: MeasureHandler | null = null;

  private blobUrl: string | null = null;
  private sidebarEl: HTMLDivElement | null = null;
  private sidebarComponent: ReturnType<typeof mount> | null = null;
  private controlsEl: HTMLDivElement | null = null;
  private controlsComponent: ReturnType<typeof mount> | null = null;
  private updateSidebar: ((state: SidebarState | null) => void) | null = null;
  private shapeEditingActive = false;
  private scaleBarControl: L.Control | null = null;
  private updateScaleBar: (() => void) | null = null;

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
    await this.renderMap();
  }

  private async renderMap(): Promise<void> {
    this.cleanup();

    const container = this.contentEl;
    container.empty();
    container.addClass("fantasy-map-wrapper");

    const config = this.getMapConfig();
    if (!config) {
      const formWrapper = container.createDiv({
        cls: "fantasy-map-create-form-wrapper",
      });
      renderCreateMapForm(formWrapper, this.app, (name, imagePath) => {
        const newMap = {
          id: window.crypto.randomUUID(),
          name,
          mapImagePath: imagePath,
          layers: [],
        };
        this.plugin.settings.maps.push(newMap);
        void this.plugin.saveSettings().then(() => {
          this.mapId = newMap.id;
          void this.renderMap();
        });
      });
      return;
    }

    if (!config.mapImagePath) {
      container.createEl("p", {
        text: "No map image configured. Go to settings > fantasy map to set a map image path.",
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
      const imageUrl = await loadImageAsBlobUrl(this.app, config.mapImagePath);
      this.blobUrl = imageUrl;
      const dimensions = await getImageDimensions(imageUrl);
      this.initializeMap(imageUrl, dimensions, config);
    } catch (error) {
      const isNotFound =
        error instanceof Error &&
        error.message.startsWith("Map image not found");
      if (isNotFound) {
        const errorEl = container.createDiv({ cls: "fantasy-map-error" });
        errorEl.createEl("p", {
          text: `Map image not found: "${config.mapImagePath}". Please choose a new image.`,
        });
        const btn = errorEl.createEl("button", { text: "Browse for image…" });
        btn.addEventListener("click", () => {
          new ImageSuggestModal(this.app, (file) => {
            config.mapImagePath = file.path;
            void this.plugin.saveSettings().then(() => void this.renderMap());
          }).open();
        });
      } else {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        container.createEl("p", {
          text: `Failed to load map: ${message}`,
          cls: "fantasy-map-error",
        });
      }
    }

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
    if (this.controlsComponent) {
      void unmount(this.controlsComponent);
      this.controlsComponent = null;
    }
    this.updateSidebar = null;
    this.sidebarEl = null;
    this.controlsEl = null;
    this.layers = [];
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
    await Promise.resolve(this.cleanup());
  }

  private initializeMap(
    imageUrl: string,
    dimensions: { width: number; height: number },
    config: MapConfig,
  ): void {
    if (!this.mapContainerEl || !this.mapId) return;

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [dimensions.height, dimensions.width],
    ];

    const map = L.map(this.mapContainerEl, {
      crs: L.CRS.Simple,
      zoomControl: false,
      ...MAP_CONFIG,
    });
    this.map = map;

    L.imageOverlay(imageUrl, bounds).addTo(map);
    map.fitBounds(bounds);

    const layerControl = L.control
      .layers({}, {}, { position: "topright" })
      .addTo(map);

    const calibration = new CalibrationHandler(
      map,
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
    this.calibration = calibration;

    const measure = new MeasureHandler(map, () => this.getMapConfig());
    this.measure = measure;

    const selection = new SelectionManager(map);
    this.selection = selection;

    const ctx: MapContext = {
      app: this.app,
      plugin: this.plugin,
      mapId: this.mapId,
      config,
      map,
      layers: this.layers,
      layerControl,
      selection,
      selectFeature: (state, leafletLayer) =>
        this.selectFeature(state, leafletLayer),
      saveLayer: (layer) => this.saveLayer(layer),
      refreshMapLayers: () => this.refreshMapLayers(),
    };

    const localMapLinker = new LocalMapLinker(ctx);
    // promptAddLayer closes over layerMgr declared below; only invoked on user
    // action after init, so the binding is always set by call time.
    let layerMgr!: LayerManager;
    const featureCtrl = new FeatureController(
      ctx,
      localMapLinker,
      (onCreated) => layerMgr.promptAdd(onCreated),
    );
    const sidebarBuilder = new SidebarStateBuilder(
      ctx,
      featureCtrl,
      localMapLinker,
      this,
    );
    layerMgr = new LayerManager(ctx, sidebarBuilder);

    const parentConfig = config.parentMapId
      ? this.plugin.settings.maps.find((m) => m.id === config.parentMapId)
      : undefined;

    this.controlsEl = this.mapContainerEl.createDiv({
      cls: "fantasy-map-controls-overlay",
    });
    L.DomEvent.disableClickPropagation(this.controlsEl);
    this.controlsComponent = mount(MapControls, {
      target: this.controlsEl,
      props: {
        map,
        onSetScale: (onDone: () => void) => calibration.start(onDone),
        onCancelSetScale: () => calibration.cancel(),
        onMeasure: (onDone: () => void) => measure.start(onDone),
        onCancelMeasure: () => measure.cleanup(),
        onManageLayers: () => layerMgr.promptManage(),
        onModeChange: (mode: string | null) => {
          this.shapeEditingActive = mode === "edit" || mode === "drag" || mode === "removal";
        },
        parentName:
          parentConfig?.name ?? (config.parentMapId ? "Parent Map" : undefined),
        onNavigateBack: config.parentMapId
          ? () => void this.plugin.openMap(config.parentMapId!)
          : undefined,
      },
    });

    if (config.scale) {
      this.renderScaleBar(config);
    }

    map.on("pm:create", (e: { shape?: string; layer: L.Layer }) => {
      if (e.shape === "Marker") {
        const marker = e.layer as L.Marker;
        const latlng = marker.getLatLng();
        map.removeLayer(marker);
        featureCtrl.openAddMarker(latlng);
      } else if (e.shape === "Polygon" || e.shape === "Rectangle") {
        const polygon = e.layer as L.Polygon;
        map.removeLayer(polygon);
        featureCtrl.openAddPolygon(polygon);
      }
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (calibration.mode !== "off") {
        calibration.handleClick(e.latlng);
        return;
      }
      if (measure.mode !== "off") {
        measure.handleClick(e.latlng);
        return;
      }
      this.selectFeature(null);
    });

    map.on("contextmenu", (e: L.LeafletMouseEvent) => {
      if (calibration.mode !== "off") return;
      if (measure.mode !== "off") return;
      this.showAddMarkerMenu(e, featureCtrl);
    });

    layerMgr.loadAndDisplay();
  }

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

  private showAddMarkerMenu(
    e: L.LeafletMouseEvent,
    featureCtrl: FeatureController,
  ): void {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle("Add marker here");
      item.setIcon("map-pin");
      item.onClick(() => {
        featureCtrl.openAddMarker(e.latlng);
      });
    });
    menu.showAtPosition({
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY,
    });
  }

  private selectFeature(
    state: SidebarState | null,
    leafletLayer?: L.Layer,
  ): void {
    if (!this.selection) return;
    if (state && this.shapeEditingActive) return;
    this.selection.clear();

    this.updateSidebar?.(state);
    if (this.sidebarEl) {
      this.sidebarEl.classList.toggle("fantasy-map-sidebar--hidden", !state);
    }

    if (state && leafletLayer) {
      this.selection.select(leafletLayer, state, this.layers);
    }
  }

  private async saveLayer(layer: LoadedLayer): Promise<void> {
    layer.config.features = layer.data.features as LayerConfig["features"];
    await this.plugin.saveSettings();
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
