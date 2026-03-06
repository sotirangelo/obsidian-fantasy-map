<script lang="ts">
  import { icon } from "../utils";
  import * as L from "leaflet";
  import { DEFAULT_MARKER_COLOR } from "../config";

  interface Props {
    map: L.Map;
    onSetScale: (onDone: () => void) => void;
    onCancelSetScale: () => void;
    onMeasure: (onDone: () => void) => void;
    onCancelMeasure: () => void;
    onAddLayer: () => void;
    parentName?: string;
    onNavigateBack?: () => void;
  }

  let {
    map,
    onSetScale,
    onCancelSetScale,
    onMeasure,
    onCancelMeasure,
    onAddLayer,
    parentName,
    onNavigateBack,
  }: Props = $props();

  let activeMode = $state<string | null>(null);

  function zoomIn() {
    map.zoomIn();
  }

  function zoomOut() {
    map.zoomOut();
  }

  function disableAllModes() {
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalDragMode();
    map.pm.disableGlobalRemovalMode();
  }

  function toggleDraw(shape: string) {
    if (activeMode === `draw:${shape}`) {
      disableAllModes();
      activeMode = null;
    } else {
      disableAllModes();
      map.pm.enableDraw(
        shape,
        shape === "Marker"
          ? {
              markerStyle: {
                icon: L.divIcon({
                  className: "fantasy-map-dot-icon",
                  html: `<span class="marker-dot" style="background:${DEFAULT_MARKER_COLOR};"></span>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                }),
              },
            }
          : {},
      );
      activeMode = `draw:${shape}`;
    }
  }

  function toggleEdit() {
    if (activeMode === "edit") {
      disableAllModes();
      activeMode = null;
    } else {
      disableAllModes();
      map.pm.enableGlobalEditMode();
      activeMode = "edit";
    }
  }

  function toggleDrag() {
    if (activeMode === "drag") {
      disableAllModes();
      activeMode = null;
    } else {
      disableAllModes();
      map.pm.enableGlobalDragMode();
      activeMode = "drag";
    }
  }

  function toggleRemoval() {
    if (activeMode === "removal") {
      disableAllModes();
      activeMode = null;
    } else {
      disableAllModes();
      map.pm.enableGlobalRemovalMode();
      activeMode = "removal";
    }
  }

  function resetActiveMode() {
    activeMode = null;
  }

  function toggleSetScale() {
    if (activeMode === "setScale") {
      onCancelSetScale();
      activeMode = null;
    } else {
      if (activeMode === "measure") onCancelMeasure();
      disableAllModes();
      activeMode = "setScale";
      onSetScale(resetActiveMode);
    }
  }

  function toggleMeasure() {
    if (activeMode === "measure") {
      onCancelMeasure();
      activeMode = null;
    } else {
      if (activeMode === "setScale") onCancelSetScale();
      disableAllModes();
      activeMode = "measure";
      onMeasure(resetActiveMode);
    }
  }

  // Listen for Geoman draw end to reset active state
  $effect(() => {
    const handler = () => {
      if (activeMode?.startsWith("draw:")) {
        activeMode = null;
      }
    };
    map.on("pm:drawend", handler);
    return () => {
      map.off("pm:drawend", handler);
    };
  });
</script>

{#if parentName && onNavigateBack}
  <div class="map-controls map-controls--top-left">
    <button
      class="map-control-btn map-control-btn--back"
      aria-label="Back to {parentName}"
      onclick={onNavigateBack}
    >
      <span class="map-control-icon" use:icon={"arrow-left"}></span>
      <span class="map-control-label">{parentName}</span>
    </button>
  </div>
{/if}

<div class="map-controls map-controls--bottom-right">
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "setScale"}
    aria-label="Set Scale"
    onclick={toggleSetScale}
  >
    <span class="map-control-icon" use:icon={"pencil-ruler"}></span>
  </button>
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "measure"}
    aria-label="Measure Distance"
    onclick={toggleMeasure}
  >
    <span class="map-control-icon" use:icon={"ruler"}></span>
  </button>
  <button class="map-control-btn" aria-label="Add Layer" onclick={onAddLayer}>
    <span class="map-control-icon" use:icon={"layers"}></span>
  </button>
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "draw:Marker"}
    aria-label="Draw Marker"
    onclick={() => toggleDraw("Marker")}
  >
    <span class="map-control-icon" use:icon={"map-pin"}></span>
  </button>
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "draw:Rectangle"}
    aria-label="Draw Rectangle"
    onclick={() => toggleDraw("Rectangle")}
  >
    <span class="map-control-icon" use:icon={"square"}></span>
  </button>
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "draw:Polygon"}
    aria-label="Draw Polygon"
    onclick={() => toggleDraw("Polygon")}
  >
    <span class="map-control-icon" use:icon={"pentagon"}></span>
  </button>

  <div class="map-controls-separator"></div>

  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "edit"}
    aria-label="Edit Layers"
    onclick={toggleEdit}
  >
    <span class="map-control-icon" use:icon={"pencil"}></span>
  </button>
  <button
    class="map-control-btn"
    class:map-control-btn--active={activeMode === "drag"}
    aria-label="Drag Layers"
    onclick={toggleDrag}
  >
    <span class="map-control-icon" use:icon={"move"}></span>
  </button>
  <button
    class="map-control-btn map-control-btn--danger"
    class:map-control-btn--active={activeMode === "removal"}
    aria-label="Remove Layers"
    onclick={toggleRemoval}
  >
    <span class="map-control-icon" use:icon={"trash-2"}></span>
  </button>
  <button class="map-control-btn" aria-label="Zoom in" onclick={zoomIn}>
    <span class="map-control-icon" use:icon={"plus"}></span>
  </button>
  <button class="map-control-btn" aria-label="Zoom out" onclick={zoomOut}>
    <span class="map-control-icon" use:icon={"minus"}></span>
  </button>
</div>

<style>
  .map-controls {
    position: absolute;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: auto;
  }

  .map-controls--top-left {
    top: 10px;
    left: 10px;
  }

  .map-controls--bottom-right {
    bottom: 10px;
    right: 10px;
  }

  .map-control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    transition:
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .map-control-btn:hover {
    background: var(--interactive-hover);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .map-control-btn--active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .map-control-btn--active:hover {
    background: var(--interactive-accent-hover);
  }

  .map-control-btn--danger.map-control-btn--active {
    background: var(--text-error);
    border-color: var(--text-error);
    color: white;
  }

  .map-control-btn--back {
    width: auto;
    padding: 0 10px;
  }

  .map-control-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map-control-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .map-control-label {
    font-size: 0.85em;
    white-space: nowrap;
  }

  .map-controls-separator {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 2px 4px;
  }
</style>
