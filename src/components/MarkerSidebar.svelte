<script lang="ts">
  import type { MarkerProperties } from "../types";

  interface SidebarState {
    properties: MarkerProperties;
    onOpenNote: (path: string) => void;
    onEdit: () => void;
    onDelete: () => void;
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
</script>

<div class="fantasy-map-sidebar-content">
  {#if selected}
    <div class="sidebar-marker">
      <h3 class="sidebar-marker-title">
        {selected.properties.icon
          ? `${selected.properties.icon} `
          : ""}{selected.properties.name}
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
      <div class="sidebar-buttons">
        <button class="sidebar-btn" onclick={() => selected?.onEdit()}
          >Edit</button
        >
        <button
          class="sidebar-btn sidebar-btn-danger"
          onclick={() => selected?.onDelete()}>Delete</button
        >
      </div>
    </div>
  {/if}
</div>
