import type * as L from "leaflet";
import type FantasyMapPlugin from "../main";
import type {
  LoadedLayer,
  MapConfig,
  ObsidianApp,
  SidebarState,
} from "../types";
import type { SelectionManager } from "./SelectionManager";

export interface MapContext {
  app: ObsidianApp;
  plugin: FantasyMapPlugin;
  mapId: string;
  config: MapConfig;
  map: L.Map;
  layers: LoadedLayer[];
  layerControl: L.Control.Layers;
  selection: SelectionManager;
  selectFeature: (state: SidebarState | null, leafletLayer?: L.Layer) => void;
  saveLayer: (layer: LoadedLayer) => Promise<void>;
  refreshMapLayers: () => void;
}
