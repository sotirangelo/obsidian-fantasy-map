<script lang="ts">
  import type { MarkerProperties } from "../types";

  interface Props {
    properties: MarkerProperties;
    onOpenNote: (notePath: string) => void;
    onEdit: () => void;
    onDelete: () => void;
  }

  let { properties, onOpenNote, onEdit, onDelete }: Props = $props();
</script>

<div class="fantasy-map-popup">
  <h4>{properties.icon ? `${properties.icon} ` : ""}{properties.name}</h4>
  {#if properties.description}
    <p class="popup-description">{properties.description}</p>
  {/if}
  {#if properties.note}
    <button
      class="popup-note-link"
      onclick={() => onOpenNote(properties.note)}
    >
      Open: {properties.note}
    </button>
  {/if}
  <div class="popup-buttons">
    <button class="popup-btn" onclick={onEdit}>Edit</button>
    <button class="popup-btn popup-btn-danger" onclick={onDelete}>Delete</button>
  </div>
</div>
