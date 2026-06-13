import { ItemView, WorkspaceLeaf, Notice, Menu } from "obsidian";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { mount, unmount } from "svelte";
import type FantasyMapPlugin from "src/main";
import type {
  LayerConfig,
  LoadedLayer,
  MapConfig,
  SidebarState,
} from "src/types";
import { MAP_CONFIG } from "src/config";
import { ScaleBarController } from "./ScaleBarController";
import { CalibrationHandler } from "./CalibrationHandler";
import { MeasureHandler } from "./MeasureHandler";
import { SelectionManager } from "./SelectionManager";
import Sidebar from "src/components/Sidebar.svelte";
import MapControls from "src/components/MapControls.svelte";
import { renderCreateMapForm } from "src/modals/CreateMapModal";
import { ImageSuggestModal } from "src/modals/ImageSuggestModal";
import { loadImageAsBlobUrl, getImageDimensions } from "./image";
import type { MapContext } from "./context";
import { LocalMapLinker } from "./LocalMapLinker";
import { FeatureController } from "./FeatureController";
import { SidebarStateBuilder } from "./SidebarStateBuilder";
import { LayerManager } from "./LayerManager";
import { Disposables } from "./disposables";

export const FANTASY_MAP_VIEW = "fantasy-map-view";

interface ImageDimensions {
  width: number;
  height: number;
}

interface MapHandlers {
  calibration: CalibrationHandler;
  measure: MeasureHandler;
  selection: SelectionManager;
}

interface MapControllers {
  featureCtrl: FeatureController;
  layerMgr: LayerManager;
}

export class FantasyMapView extends ItemView {
  plugin: FantasyMapPlugin;
  mapId: string | null = null;
  mapContainerEl: HTMLDivElement | null = null;

  private map: L.Map | null = null;
  private layers: LoadedLayer[] = [];
  private selection: SelectionManager | null = null;
  private sidebarEl: HTMLDivElement | null = null;
  private updateSidebar: ((state: SidebarState | null) => void) | null = null;
  private shapeEditingActive = false;
  private scaleBar: ScaleBarController | null = null;
  private disposables = new Disposables();

  constructor(leaf: WorkspaceLeaf, plugin: FantasyMapPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return FANTASY_MAP_VIEW;
  }

  getDisplayText(): string {
    return this.getMapConfig()?.name ?? "Fantasy Map";
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

  async onClose(): Promise<void> {
    await Promise.resolve(this.cleanup());
  }

  private async renderMap(): Promise<void> {
    this.cleanup();

    const container = this.contentEl;
    container.empty();
    container.addClass("fantasy-map-wrapper");

    const config = this.getMapConfig();
    if (!config) {
      this.renderCreateForm(container);
      return;
    }

    if (!config.mapImagePath) {
      container.createEl("p", {
        text: "No map image configured. Go to settings > fantasy map to set a map image path.",
        cls: "fantasy-map-notice",
      });
      return;
    }

    this.mountSidebar(container);

    try {
      const imageUrl = await loadImageAsBlobUrl(this.app, config.mapImagePath);
      this.disposables.add(() => URL.revokeObjectURL(imageUrl));
      const dimensions = await getImageDimensions(imageUrl);
      this.initializeMap(imageUrl, dimensions, config);
    } catch (error) {
      this.renderLoadError(container, config, error);
    }

    (this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
  }

  private renderCreateForm(container: HTMLElement): void {
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
  }

  private renderLoadError(
    container: HTMLElement,
    config: MapConfig,
    error: unknown,
  ): void {
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
      const message = error instanceof Error ? error.message : "Unknown error";
      container.createEl("p", {
        text: `Failed to load map: ${message}`,
        cls: "fantasy-map-error",
      });
    }
  }

  private mountSidebar(container: HTMLElement): void {
    const sidebarEl = container.createDiv({
      cls: "fantasy-map-sidebar fantasy-map-sidebar--hidden",
    });
    this.sidebarEl = sidebarEl;
    this.mapContainerEl = container.createDiv({ cls: "fantasy-map-container" });

    const sidebarComponent = mount(Sidebar, {
      target: sidebarEl,
      props: {
        registerUpdate: (fn: (state: SidebarState | null) => void) => {
          this.updateSidebar = fn;
        },
      },
    });
    this.disposables.add(() => void unmount(sidebarComponent));
  }

  private getMapConfig(): MapConfig | undefined {
    if (!this.mapId) return undefined;
    return this.plugin.settings.maps.find((m) => m.id === this.mapId);
  }

  private cleanup(): void {
    this.disposables.disposeAll();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.selection?.clear();
    this.scaleBar?.dispose();
    this.scaleBar = null;
    this.selection = null;
    this.updateSidebar = null;
    this.sidebarEl = null;
    this.mapContainerEl = null;
    this.layers = [];
  }

  private initializeMap(
    imageUrl: string,
    dimensions: ImageDimensions,
    config: MapConfig,
  ): void {
    if (!this.mapContainerEl || !this.mapId) return;

    const { map, layerControl } = this.createLeafletMap(
      this.mapContainerEl,
      imageUrl,
      dimensions,
    );
    this.map = map;

    const handlers = this.createHandlers(map);
    this.selection = handlers.selection;

    const ctx = this.buildContext(config, map, layerControl, handlers.selection);
    const localMapLinker = new LocalMapLinker(ctx);
    const controllers = this.createControllers(ctx, localMapLinker);

    this.mountMapControls(map, config, handlers, controllers.layerMgr);

    this.scaleBar = new ScaleBarController(map);
    if (config.scale) this.scaleBar.render(config);

    this.wireMapEvents(map, handlers, controllers.featureCtrl);

    controllers.layerMgr.loadAndDisplay();
  }

  private createLeafletMap(
    container: HTMLDivElement,
    imageUrl: string,
    dimensions: ImageDimensions,
  ): { map: L.Map; layerControl: L.Control.Layers } {
    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [dimensions.height, dimensions.width],
    ];
    const map = L.map(container, {
      crs: L.CRS.Simple,
      zoomControl: false,
      ...MAP_CONFIG,
    });
    L.imageOverlay(imageUrl, bounds).addTo(map);
    map.fitBounds(bounds);

    const layerControl = L.control
      .layers({}, {}, { position: "topright" })
      .addTo(map);

    return { map, layerControl };
  }

  private createHandlers(map: L.Map): MapHandlers {
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
          this.scaleBar?.render(cfg);
          this.refreshMapLayers();
          new Notice(
            `Scale set: ${realDistance.toString()} ${unit} between the two points`,
          );
        });
      },
    );
    this.disposables.add(() => calibration.cleanup());

    const measure = new MeasureHandler(map, () => this.getMapConfig());
    this.disposables.add(() => measure.cleanup());

    const selection = new SelectionManager(map);

    return { calibration, measure, selection };
  }

  private buildContext(
    config: MapConfig,
    map: L.Map,
    layerControl: L.Control.Layers,
    selection: SelectionManager,
  ): MapContext {
    return {
      app: this.app,
      plugin: this.plugin,
      mapId: this.mapId!,
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
  }

  private createControllers(
    ctx: MapContext,
    localMapLinker: LocalMapLinker,
  ): MapControllers {
    // FeatureController and LayerManager have a circular need: FeatureController
    // can prompt to add a layer, LayerManager uses SidebarStateBuilder which uses
    // FeatureController. Late-bind layerMgr via closure — promptAddLayer is only
    // ever called after init from user actions.
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
    return { featureCtrl, layerMgr };
  }

  private mountMapControls(
    map: L.Map,
    config: MapConfig,
    handlers: MapHandlers,
    layerMgr: LayerManager,
  ): void {
    if (!this.mapContainerEl) return;
    const { calibration, measure } = handlers;

    const parentConfig = config.parentMapId
      ? this.plugin.settings.maps.find((m) => m.id === config.parentMapId)
      : undefined;

    const controlsEl = this.mapContainerEl.createDiv({
      cls: "fantasy-map-controls-overlay",
    });
    L.DomEvent.disableClickPropagation(controlsEl);

    const controlsComponent = mount(MapControls, {
      target: controlsEl,
      props: {
        map,
        onSetScale: (onDone: () => void) => calibration.start(onDone),
        onCancelSetScale: () => calibration.cancel(),
        onMeasure: (onDone: () => void) => measure.start(onDone),
        onCancelMeasure: () => measure.cleanup(),
        onManageLayers: () => layerMgr.promptManage(),
        onModeChange: (mode: string | null) => {
          const isDraw = mode?.startsWith("draw:") ?? false;
          this.shapeEditingActive =
            mode === "edit" || mode === "drag" || mode === "removal" || isDraw;
          map.getContainer().classList.toggle("is-drawing", isDraw);
        },
        parentName:
          parentConfig?.name ?? (config.parentMapId ? "Parent Map" : undefined),
        onNavigateBack: config.parentMapId
          ? () => void this.plugin.openMap(config.parentMapId!)
          : undefined,
      },
    });
    this.disposables.add(() => void unmount(controlsComponent));
  }

  private wireMapEvents(
    map: L.Map,
    handlers: MapHandlers,
    featureCtrl: FeatureController,
  ): void {
    const { calibration, measure } = handlers;

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
        layer.rings?.clearLayers();
        layer.leafletLayer.clearLayers();
        layer.leafletLayer.addData(layer.data);
      }
    }
  }
}
