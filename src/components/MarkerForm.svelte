<script lang="ts">
  import { untrack } from "svelte";
  import type { MarkerProperties } from "../types";

  interface Props {
    initialProperties: MarkerProperties;
    layerOptions: { id: string; name: string }[];
    initialLayerId: string;
    isEdit: boolean;
    onBrowseNote: (cb: (path: string) => void) => void;
    onSubmit: (properties: MarkerProperties, layerId: string) => void;
  }

  let {
    initialProperties,
    layerOptions,
    initialLayerId,
    isEdit,
    onBrowseNote,
    onSubmit,
  }: Props = $props();

  let name = $state(untrack(() => initialProperties.name));
  let note = $state(untrack(() => initialProperties.note));
  let icon = $state(untrack(() => initialProperties.icon));
  let description = $state(untrack(() => initialProperties.description));
  let selectedLayerId = $state(untrack(() => initialLayerId));
  let error = $state("");

  function handleSubmit() {
    if (!name.trim()) {
      error = "Marker name is required";
      return;
    }
    error = "";
    onSubmit(
      {
        id: initialProperties.id,
        name: name.trim(),
        note,
        icon,
        color: initialProperties.color,
        description,
      },
      selectedLayerId,
    );
  }

  function browseNote() {
    onBrowseNote((path) => {
      note = path;
    });
  }
</script>

<h2>{isEdit ? "Edit Marker" : "Add Marker"}</h2>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Name</div>
    <div class="setting-item-description">Display name for the marker</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="Waterdeep"
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Linked note</div>
    <div class="setting-item-description">
      Obsidian note to link (e.g. Cities/Waterdeep)
    </div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="Cities/waterdeep"
      value={note}
      oninput={(e) => (note = e.currentTarget.value)}
    />
    <button onclick={browseNote}>Browse</button>
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Icon</div>
    <div class="setting-item-description">Emoji or short text for the marker</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="🏰"
      value={icon}
      oninput={(e) => (icon = e.currentTarget.value)}
    />
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Description</div>
    <div class="setting-item-description">Short description shown in the popup</div>
  </div>
  <div class="setting-item-control">
    <textarea
      placeholder="A bustling port city on the sword coast"
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    ></textarea>
  </div>
</div>

{#if !isEdit && layerOptions.length > 0}
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Layer</div>
      <div class="setting-item-description">
        Which layer to add this marker to
      </div>
    </div>
    <div class="setting-item-control">
      <select
        value={selectedLayerId}
        onchange={(e) => (selectedLayerId = e.currentTarget.value)}
      >
        {#each layerOptions as opt (opt.id)}
          <option value={opt.id}>{opt.name}</option>
        {/each}
      </select>
    </div>
  </div>
{/if}

{#if error}
  <p class="fantasy-map-form-error">{error}</p>
{/if}

<div class="setting-item">
  <div class="setting-item-control">
    <button class="mod-cta" onclick={handleSubmit}>
      {isEdit ? "Save" : "Add Marker"}
    </button>
  </div>
</div>
