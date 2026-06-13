import type * as L from "leaflet";
import type { LoadedLayer, MapFeature } from "src/types";

export function getId(feature: { properties: unknown }): string {
  return (feature.properties as { id: string }).id;
}

export function forEachFeature(
  layers: LoadedLayer[],
  cb: (feature: MapFeature, layer: LoadedLayer) => void,
): void {
  for (const layer of layers) {
    for (const feature of layer.data.features as MapFeature[]) {
      cb(feature, layer);
    }
  }
}

export function findFeatureById(
  layers: LoadedLayer[],
  featureId: string,
): { feature: MapFeature; layer: LoadedLayer } | undefined {
  for (const layer of layers) {
    const feature = (layer.data.features as MapFeature[]).find(
      (f) => getId(f) === featureId,
    );
    if (feature) return { feature, layer };
  }
  return undefined;
}

export function findLeafletLayerById(
  layers: LoadedLayer[],
  featureId: string,
): L.Layer | undefined {
  for (const loaded of layers) {
    if (!loaded.leafletLayer) continue;
    let found: L.Layer | undefined;
    loaded.leafletLayer.eachLayer((l) => {
      const f = (l as L.Layer & { feature?: { properties?: { id?: string } } })
        .feature;
      if (f?.properties?.id === featureId) found = l;
    });
    if (found) return found;
  }
  return undefined;
}

export function getAllFeatureRefs(
  layers: LoadedLayer[],
  excludeId?: string,
): { id: string; name: string }[] {
  const refs: { id: string; name: string }[] = [];
  forEachFeature(layers, (feature) => {
    const props = feature.properties as { id: string; name: string };
    if (props.id !== excludeId) refs.push({ id: props.id, name: props.name });
  });
  return refs;
}

export function findIncomingRelations(
  layers: LoadedLayer[],
  featureId: string,
): { featureId: string; featureName: string; label: string }[] {
  const incoming: { featureId: string; featureName: string; label: string }[] =
    [];
  forEachFeature(layers, (feature) => {
    const props = feature.properties;
    if (props.id === featureId) return;
    for (const rel of props.relations ?? []) {
      if (rel.featureId === featureId) {
        incoming.push({
          featureId: props.id,
          featureName: props.name,
          label: rel.label,
        });
      }
    }
  });
  return incoming;
}
