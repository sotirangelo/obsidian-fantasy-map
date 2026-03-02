import type { DataAdapter } from "obsidian";
import type { MapFeatureCollection, LoadedLayer } from "./types";

export async function ensureLayerFolder(
  adapter: DataAdapter,
  folderPath: string,
): Promise<void> {
  const exists = await adapter.exists(folderPath);
  if (!exists) {
    await adapter.mkdir(folderPath);
  }
}

export async function loadAllLayers(
  adapter: DataAdapter,
  folderPath: string,
): Promise<LoadedLayer[]> {
  const layers: LoadedLayer[] = [];
  const listing = await adapter.list(folderPath);

  for (const filePath of listing.files) {
    if (!filePath.endsWith(".geojson")) continue;

    try {
      const content = await adapter.read(filePath);
      const data = JSON.parse(content) as MapFeatureCollection;

      if (!Array.isArray(data.features)) {
        console.warn(`Fantasy Map: Invalid GeoJSON in ${filePath}, skipping`);
        continue;
      }

      const fileName = filePath.split("/").pop() ?? filePath;
      layers.push({
        filePath,
        fileName,
        data,
        leafletLayer: null,
      });
    } catch (error) {
      console.warn(`Fantasy Map: Failed to load layer ${filePath}:`, error);
    }
  }

  return layers;
}

export async function createNewLayer(
  adapter: DataAdapter,
  filePath: string,
): Promise<MapFeatureCollection> {
  const emptyCollection: MapFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const json = JSON.stringify(emptyCollection, null, 2);
  await adapter.write(filePath, json);
  return emptyCollection;
}
