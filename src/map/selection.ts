import * as L from "leaflet";
import type {
  LoadedLayer,
  MapFeature,
  MarkerProperties,
  PolygonProperties,
  PolygonFeature,
  SidebarState,
} from "../types";

export class SelectionManager {
  private map: L.Map;
  private selectedLayer: L.Layer | null = null;
  private selectionRing: L.CircleMarker | null = null;
  private relationHighlights: L.CircleMarker[] = [];
  private relationArrows: L.Layer[] = [];
  private hiddenLayers: { layer: L.Layer; parent: L.GeoJSON }[] = [];

  constructor(map: L.Map) {
    this.map = map;
  }

  get selected(): L.Layer | null {
    return this.selectedLayer;
  }

  select(
    leafletLayer: L.Layer,
    state: SidebarState,
    layers: LoadedLayer[],
  ): void {
    this.clear();
    this.selectedLayer = leafletLayer;

    this.highlightSelected(leafletLayer);
    this.highlightRelations(state, layers);

    const featureId = (state.properties as { id: string }).id;
    this.drawRelationArrows(
      featureId,
      leafletLayer,
      (state.relations ?? []).map((r) => ({
        featureId: r.featureId,
        label: r.label,
      })),
      layers,
    );

    this.hideUnrelatedFeatures(featureId, state, layers);
  }

  clear(): void {
    this.clearRelationArrows();

    for (const { layer, parent } of this.hiddenLayers) {
      parent.addLayer(layer);
    }
    this.hiddenLayers = [];

    for (const ring of this.relationHighlights) {
      this.map.removeLayer(ring);
    }
    this.relationHighlights = [];

    if (this.selectionRing) {
      this.map.removeLayer(this.selectionRing);
      this.selectionRing = null;
    }

    if (this.selectedLayer) {
      if (this.selectedLayer instanceof L.Marker) {
        const el = this.selectedLayer.getElement();
        el?.classList.remove("fantasy-map-marker--selected");
      } else if (this.selectedLayer instanceof L.Polygon) {
        const feature = (
          this.selectedLayer as unknown as { feature?: PolygonFeature }
        ).feature;
        const color = feature?.properties.color ?? "#3388ff";
        this.selectedLayer.setStyle({
          weight: 2,
          dashArray: undefined,
          className: "",
        });
        this.selectedLayer.setStyle({ color, fillColor: color });
      }
      this.selectedLayer = null;
    }
  }

  updateDragPosition(marker: L.Marker): void {
    if (this.selectionRing && this.selectedLayer === marker) {
      this.selectionRing.setLatLng(marker.getLatLng());
    }
  }

  private hideUnrelatedFeatures(
    selectedId: string,
    state: SidebarState,
    layers: LoadedLayer[],
  ): void {
    const relatedIds = new Set<string>();
    relatedIds.add(selectedId);
    for (const rel of state.relations ?? []) {
      relatedIds.add(rel.featureId);
    }
    for (const rel of state.incomingRelations ?? []) {
      relatedIds.add(rel.featureId);
    }

    for (const loadedLayer of layers) {
      if (!loadedLayer.leafletLayer) continue;
      const toHide: L.Layer[] = [];
      loadedLayer.leafletLayer.eachLayer((subLayer) => {
        const f = (subLayer as unknown as { feature?: MapFeature }).feature;
        const id = (f?.properties as { id?: string } | undefined)?.id;
        if (id && !relatedIds.has(id)) {
          toHide.push(subLayer);
        }
      });
      for (const sub of toHide) {
        loadedLayer.leafletLayer.removeLayer(sub);
        this.hiddenLayers.push({ layer: sub, parent: loadedLayer.leafletLayer });
      }
    }
  }

  private highlightSelected(leafletLayer: L.Layer): void {
    if (leafletLayer instanceof L.Marker) {
      const latlng = leafletLayer.getLatLng();
      this.selectionRing = L.circleMarker(latlng, {
        radius: 20,
        weight: 3,
        color: "var(--text-accent)",
        fillColor: "var(--text-accent)",
        fillOpacity: 0.15,
        className: "fantasy-map-selection-ring",
        interactive: false,
      }).addTo(this.map);
      const el = leafletLayer.getElement();
      el?.classList.add("fantasy-map-marker--selected");
    } else if (leafletLayer instanceof L.Polygon) {
      const feature = (
        leafletLayer as unknown as { feature?: PolygonFeature }
      ).feature;
      const fillColor = feature?.properties.color ?? "#3388ff";
      leafletLayer.setStyle({
        weight: 4,
        color: "var(--text-accent)",
        fillColor,
        fillOpacity: 0.45,
        className: "fantasy-map-polygon--selected",
      });
    }
  }

  private highlightRelations(
    state: SidebarState,
    layers: LoadedLayer[],
  ): void {
    // Outgoing relations
    for (const rel of state.relations ?? []) {
      const relatedLayer = this.findLeafletLayerById(rel.featureId, layers);
      if (!relatedLayer) continue;
      const latlng = this.getLayerLatLng(relatedLayer);
      if (!latlng) continue;

      this.addRelationRing(latlng, "#f59e0b");
    }

    // Incoming relations
    const featureId = (state.properties as { id: string }).id;
    const incoming = findIncomingRelations(featureId, layers);
    for (const rel of incoming) {
      const relatedLayer = this.findLeafletLayerById(rel.featureId, layers);
      if (!relatedLayer) continue;
      const latlng = this.getLayerLatLng(relatedLayer);
      if (!latlng) continue;

      this.addRelationRing(latlng, "#8b5cf6");
    }
  }

  private addRelationRing(latlng: L.LatLng, color: string): void {
    const ring = L.circleMarker(latlng, {
      radius: 18,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.12,
      dashArray: "5 4",
      interactive: false,
      className: "fantasy-map-relation-ring",
    }).addTo(this.map);
    this.relationHighlights.push(ring);
  }

  private drawRelationArrows(
    selectedId: string,
    leafletLayer: L.Layer,
    outgoing: { featureId: string; label: string }[],
    layers: LoadedLayer[],
  ): void {
    const from = this.getLayerLatLng(leafletLayer);
    if (!from) return;

    const incoming = findIncomingRelations(selectedId, layers);

    for (const rel of outgoing) {
      const to = this.getFeatureLatLng(rel.featureId, layers);
      if (!to) continue;
      this.addCurvedArrow(from, to, rel.label, "#f59e0b");
    }

    for (const rel of incoming) {
      const relFrom = this.getFeatureLatLng(rel.featureId, layers);
      if (!relFrom) continue;
      this.addCurvedArrow(relFrom, from, rel.label, "#8b5cf6");
    }
  }

  private addCurvedArrow(
    from: L.LatLng,
    to: L.LatLng,
    label: string,
    color: string,
  ): void {
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;

    const offset = 0.2;
    const ctrlLat = midLat + dLng * offset;
    const ctrlLng = midLng - dLat * offset;

    // Approximate bezier with polyline points
    const points: L.LatLng[] = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const lat = u * u * from.lat + 2 * u * t * ctrlLat + t * t * to.lat;
      const lng = u * u * from.lng + 2 * u * t * ctrlLng + t * t * to.lng;
      points.push(L.latLng(lat, lng));
    }

    const line = L.polyline(points, {
      color,
      weight: 2.5,
      opacity: 0.8,
      dashArray: "8 4",
      interactive: false,
      className: "fantasy-map-relation-arrow",
    }).addTo(this.map);
    this.relationArrows.push(line);

    // Arrowhead at ~85% along the curve
    const arrowT = 0.85;
    const u2 = 1 - arrowT;
    const arrowLat =
      u2 * u2 * from.lat + 2 * u2 * arrowT * ctrlLat + arrowT * arrowT * to.lat;
    const arrowLng =
      u2 * u2 * from.lng + 2 * u2 * arrowT * ctrlLng + arrowT * arrowT * to.lng;

    const tgLat =
      2 * (1 - arrowT) * (ctrlLat - from.lat) +
      2 * arrowT * (to.lat - ctrlLat);
    const tgLng =
      2 * (1 - arrowT) * (ctrlLng - from.lng) +
      2 * arrowT * (to.lng - ctrlLng);
    const angle = Math.atan2(tgLng, tgLat);

    const arrowSize = Math.sqrt(dLat * dLat + dLng * dLng) * 0.04;
    const spread = Math.PI / 6;

    const tip = L.latLng(arrowLat, arrowLng);
    const left = L.latLng(
      arrowLat - arrowSize * Math.cos(angle - spread),
      arrowLng - arrowSize * Math.sin(angle - spread),
    );
    const right = L.latLng(
      arrowLat - arrowSize * Math.cos(angle + spread),
      arrowLng - arrowSize * Math.sin(angle + spread),
    );

    const arrowhead = L.polygon([tip, left, right], {
      color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 1,
      interactive: false,
      className: "fantasy-map-relation-arrowhead",
    }).addTo(this.map);
    this.relationArrows.push(arrowhead);

    // Label at the midpoint
    const labelT = 0.5;
    const uL = 1 - labelT;
    const labelLat =
      uL * uL * from.lat + 2 * uL * labelT * ctrlLat + labelT * labelT * to.lat;
    const labelLng =
      uL * uL * from.lng + 2 * uL * labelT * ctrlLng + labelT * labelT * to.lng;

    const tooltip = L.tooltip({
      permanent: true,
      direction: "center",
      className: "fantasy-map-relation-label",
      interactive: false,
    })
      .setLatLng(L.latLng(labelLat, labelLng))
      .setContent(label)
      .addTo(this.map);
    this.relationArrows.push(tooltip);
  }

  private clearRelationArrows(): void {
    for (const layer of this.relationArrows) {
      this.map.removeLayer(layer);
    }
    this.relationArrows = [];
  }

  private findLeafletLayerById(
    featureId: string,
    layers: LoadedLayer[],
  ): L.Layer | null {
    for (const loadedLayer of layers) {
      if (!loadedLayer.leafletLayer) continue;
      const sublayers: L.Layer[] = [];
      loadedLayer.leafletLayer.eachLayer((layer) => sublayers.push(layer));
      const found = sublayers.find((layer) => {
        const f = (layer as unknown as { feature?: MapFeature }).feature;
        return (f?.properties as { id?: string } | undefined)?.id === featureId;
      });
      if (found !== undefined) return found;
    }
    return null;
  }

  private getFeatureLatLng(
    featureId: string,
    layers: LoadedLayer[],
  ): L.LatLng | null {
    const layer = this.findLeafletLayerById(featureId, layers);
    if (!layer) return null;
    return this.getLayerLatLng(layer);
  }

  private getLayerLatLng(layer: L.Layer): L.LatLng | null {
    if (layer instanceof L.Marker) return layer.getLatLng();
    if (layer instanceof L.Polygon) return layer.getBounds().getCenter();
    return null;
  }
}

export function findIncomingRelations(
  featureId: string,
  layers: LoadedLayer[],
): { featureId: string; featureName: string; label: string }[] {
  const incoming: { featureId: string; featureName: string; label: string }[] =
    [];
  for (const layer of layers) {
    for (const feature of layer.data.features) {
      const props = feature.properties as MarkerProperties | PolygonProperties;
      if (props.id === featureId) continue;
      for (const rel of props.relations ?? []) {
        if (rel.featureId === featureId) {
          incoming.push({
            featureId: props.id,
            featureName: props.name,
            label: rel.label,
          });
        }
      }
    }
  }
  return incoming;
}
