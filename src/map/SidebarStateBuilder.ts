import * as L from "leaflet";
import { MarkdownRenderer, type Component } from "obsidian";
import type {
  LoadedLayer,
  MapFeature,
  MarkerFeature,
  MarkerProperties,
  PolygonFeature,
  PolygonProperties,
  SidebarState,
} from 'src/types';
import { createMarkerFromFeature } from "./markers";
import {
  findFeatureById,
  findIncomingRelations,
  findLeafletLayerById,
  getAllFeatureRefs,
} from "./featureIndex";
import type { MapContext } from "./context";
import type { FeatureController } from "./FeatureController";
import type { LocalMapLinker } from "./LocalMapLinker";

function resolveRelations(
  props: MarkerProperties | PolygonProperties,
  layers: LoadedLayer[],
): { featureId: string; featureName: string; label: string }[] {
  const all = getAllFeatureRefs(layers);
  return (props.relations ?? []).map((r) => ({
    featureId: r.featureId,
    featureName: all.find((f) => f.id === r.featureId)?.name ?? r.featureId,
    label: r.label,
  }));
}

export class SidebarStateBuilder {
  constructor(
    private ctx: MapContext,
    private featureCtrl: FeatureController,
    private localMapLinker: LocalMapLinker,
    private renderHost: Component,
  ) {}

  build(
    featureType: "marker" | "polygon",
    props: MarkerProperties | PolygonProperties,
    feature: MapFeature,
    layer: LoadedLayer,
  ): SidebarState {
    return {
      featureType,
      properties: props,
      relations: resolveRelations(props, this.ctx.layers),
      incomingRelations: findIncomingRelations(this.ctx.layers, props.id),
      onOpenNote: (path: string) => {
        void this.ctx.app.workspace.openLinkText(path, "", false);
      },
      onReadNote: async (path: string) => {
        const file = this.ctx.app.vault.getFileByPath(`${path}.md`);
        if (!file) return null;
        return this.ctx.app.vault.cachedRead(file);
      },
      onRenderMarkdown: (markdown: string, el: HTMLElement) => {
        el.empty();
        void MarkdownRenderer.render(
          this.ctx.app,
          markdown,
          el,
          "",
          this.renderHost,
        );
      },
      onSearchTag: (tag: string) => {
        const search =
          this.ctx.app.internalPlugins?.getPluginById?.(
            "global-search",
          )?.instance;
        search?.openGlobalSearch(`tag:${tag}`);
      },
      onEdit: () => {
        this.featureCtrl.edit(featureType, props, layer);
      },
      onDelete: () => {
        this.featureCtrl.delete(props, layer);
      },
      onAddRelation: () => {
        this.featureCtrl.addRelation(props, layer);
      },
      onRemoveRelation: (targetFeatureId: string) => {
        this.featureCtrl.removeRelation(props, layer, targetFeatureId);
      },
      onSelectFeature: (featureId: string) => {
        const found = findFeatureById(this.ctx.layers, featureId);
        if (!found) return;
        const featureType =
          found.feature.geometry.type === "Point" ? "marker" : "polygon";
        const state = this.build(
          featureType,
          found.feature.properties,
          found.feature,
          found.layer,
        );
        const leafletLayer = findLeafletLayerById(this.ctx.layers, featureId);
        this.ctx.selectFeature(state, leafletLayer);
        if (leafletLayer) {
          const center =
            leafletLayer instanceof L.Marker
              ? leafletLayer.getLatLng()
              : (leafletLayer as L.Polygon).getBounds().getCenter();
          this.ctx.map.panTo(center);
        }
      },
      onOpenLocalMap: props.localMapId
        ? () => void this.ctx.plugin.openMap(props.localMapId!)
        : undefined,
      onLinkLocalMap: !props.localMapId
        ? () => {
            this.localMapLinker.openLinkForExisting(feature, layer);
          }
        : undefined,
    };
  }

  createInteractiveMarker(
    feature: MarkerFeature,
    latlng: L.LatLng,
    layer: LoadedLayer,
  ): L.Marker {
    const marker = createMarkerFromFeature(feature.properties, latlng);

    marker.bindTooltip(feature.properties.name, {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "fantasy-map-name-tooltip",
    });

    marker.on("click", () => {
      this.ctx.selectFeature(
        this.build("marker", feature.properties, feature, layer),
        marker,
      );
    });

    marker.on("drag", () => {
      this.ctx.selection.updateDragPosition(marker);
    });

    marker.on("dragend", () => {
      const newLatLng = marker.getLatLng();
      feature.geometry.coordinates = [newLatLng.lng, newLatLng.lat];
      void this.ctx.saveLayer(layer);
    });

    return marker;
  }

  attachPolygonInteraction(
    feature: PolygonFeature,
    leafletPolygon: L.Polygon,
    layer: LoadedLayer,
  ): void {
    leafletPolygon.on("click", (e: L.LeafletMouseEvent) => {
      const pm = this.ctx.map.pm;
      if (
        pm.globalEditModeEnabled() ||
        pm.globalDragModeEnabled() ||
        pm.globalRemovalModeEnabled() ||
        pm.globalDrawModeEnabled()
      ) {
        return;
      }
      L.DomEvent.stopPropagation(e);
      this.ctx.selectFeature(
        this.build("polygon", feature.properties, feature, layer),
        leafletPolygon,
      );
    });
  }
}
