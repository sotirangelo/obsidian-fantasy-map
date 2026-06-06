import type { MapFeatureCollection, LoadedLayer, LayerConfig } from 'src/types';

export function loadConfiguredLayers(
  layerConfigs: LayerConfig[],
): LoadedLayer[] {
  return layerConfigs.map((config) => {
    const features = config.features;
    const data: MapFeatureCollection = {
      type: "FeatureCollection",
      features,
    };
    return { config, data, leafletLayer: null, rings: null };
  });
}
