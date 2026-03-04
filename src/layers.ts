import type { DataAdapter } from "obsidian";
import type { MapFeatureCollection, LoadedLayer, LayerConfig } from "./types";
import { LAYERS_BASE_FOLDER } from "./config";

export function getLayerFilePath(mapId: string, layerId: string): string {
  return `${LAYERS_BASE_FOLDER}/${mapId}/${layerId}.geojson`;
}

async function ensureFolder(
  adapter: DataAdapter,
  folderPath: string,
): Promise<void> {
  const exists = await adapter.exists(folderPath);
  if (!exists) {
    await adapter.mkdir(folderPath);
  }
}

export async function loadConfiguredLayers(
  adapter: DataAdapter,
  mapId: string,
  layerConfigs: LayerConfig[],
): Promise<LoadedLayer[]> {
  await ensureFolder(adapter, LAYERS_BASE_FOLDER);
  await ensureFolder(adapter, `${LAYERS_BASE_FOLDER}/${mapId}`);

  const layers: LoadedLayer[] = [];

  for (const config of layerConfigs) {
    const filePath = getLayerFilePath(mapId, config.id);

    try {
      const exists = await adapter.exists(filePath);
      let data: MapFeatureCollection;

      if (!exists) {
        data = { type: "FeatureCollection", features: [] };
        await adapter.write(filePath, JSON.stringify(data, null, 2));
      } else {
        const content = await adapter.read(filePath);
        data = JSON.parse(content) as MapFeatureCollection;
        if (!Array.isArray(data.features)) {
          console.warn(
            `Fantasy Map: Invalid GeoJSON in ${filePath}, using empty collection`,
          );
          data = { type: "FeatureCollection", features: [] };
        }
      }

      layers.push({ config, filePath, data, leafletLayer: null });
    } catch (error) {
      console.warn(`Fantasy Map: Failed to load layer ${filePath}:`, error);
    }
  }

  return layers;
}

export async function deleteLayerFile(
  adapter: DataAdapter,
  mapId: string,
  layerId: string,
): Promise<void> {
  const filePath = getLayerFilePath(mapId, layerId);
  const exists = await adapter.exists(filePath);
  if (exists) {
    await adapter.remove(filePath);
  }
}
