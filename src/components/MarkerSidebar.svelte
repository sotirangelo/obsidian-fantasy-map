<script lang="ts">
  import type { MarkerProperties, PolygonProperties } from "../types";

  interface SidebarState {
    featureType: "marker" | "polygon";
    properties: MarkerProperties | PolygonProperties;
    onOpenNote: (path: string) => void;
    onEdit: () => void;
    onDelete: () => void;
    onOpenLocalMap?: () => void;
    onLinkLocalMap?: () => void;
  }

  interface Props {
    registerUpdate: (fn: (state: SidebarState | null) => void) => void;
  }

  let { registerUpdate }: Props = $props();
  let selected = $state<SidebarState | null>(null);

  $effect(() => {
    registerUpdate((state) => {
      selected = state;
    });
  });

  function getIcon(state: SidebarState): string {
    if (state.featureType === "marker") {
      return (state.properties as MarkerProperties).icon ?? "";
    }
    return "";
  }
</script>

<div class="fantasy-map-sidebar-content">
  {#if selected}
    <div class="sidebar-marker">
      <h3 class="sidebar-marker-title">
        {#if getIcon(selected)}{getIcon(selected)}{" "}{/if}{selected.properties.name}
      </h3>
      {#if selected.properties.description}
        <p class="sidebar-marker-description">
          {selected.properties.description}
        </p>
      {/if}
      {#if selected.properties.note}
        <button
          class="sidebar-note-link"
          onclick={() => selected?.onOpenNote(selected.properties.note)}
        >
          Open: {selected.properties.note}
        </button>
      {/if}
      {#if selected.onOpenLocalMap}
        <button
          class="sidebar-btn sidebar-btn-local-map"
          onclick={() => selected?.onOpenLocalMap?.()}
        >
          Open Local Map
        </button>
      {:else if selected.onLinkLocalMap}
        <button
          class="sidebar-btn"
          onclick={() => selected?.onLinkLocalMap?.()}
        >
          Link Local Map
        </button>
      {/if}
      <div class="sidebar-buttons">
        <button class="sidebar-btn" onclick={() => selected?.onEdit()}>Edit</button>
        <button
          class="sidebar-btn sidebar-btn-danger"
          onclick={() => selected?.onDelete()}>Delete</button
        >
      </div>
    </div>
  {/if}
</div>
