<script lang="ts">
  import { untrack } from "svelte";
  import type { PolygonProperties } from "../types";

  interface Props {
    initialProperties: PolygonProperties;
    layerOptions: { id: string; name: string }[];
    initialLayerId: string;
    isEdit: boolean;
    onBrowseNote: (cb: (path: string) => void) => void;
    onLinkLocalMap?: (cb: (mapId: string) => void) => void;
    onSubmit: (properties: PolygonProperties, layerId: string) => void;
  }

  let {
    initialProperties,
    layerOptions,
    initialLayerId,
    isEdit,
    onBrowseNote,
    onLinkLocalMap,
    onSubmit,
  }: Props = $props();

  let name = $state(untrack(() => initialProperties.name));
  let note = $state(untrack(() => initialProperties.note));
  let color = $state(untrack(() => initialProperties.color));
  let description = $state(untrack(() => initialProperties.description));
  let localMapId = $state(untrack(() => initialProperties.localMapId ?? ""));
  let selectedLayerId = $state(untrack(() => initialLayerId));
  let error = $state("");

  function handleSubmit() {
    if (!name.trim()) {
      error = "Region name is required";
      return;
    }
    error = "";
    onSubmit(
      {
        id: initialProperties.id,
        name: name.trim(),
        note,
        color,
        description,
        localMapId: localMapId || undefined,
      },
      selectedLayerId,
    );
  }

  function browseNote() {
    onBrowseNote((path) => {
      note = path;
    });
  }

  function handleLinkLocalMap() {
    onLinkLocalMap?.((mapId) => {
      localMapId = mapId;
    });
  }
</script>

<h2>{isEdit ? "Edit Region" : "Add Region"}</h2>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Name</div>
    <div class="setting-item-description">Display name for the region</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="The Dark Forest"
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Color</div>
    <div class="setting-item-description">Fill color for the region</div>
  </div>
  <div class="setting-item-control">
    <input
      type="color"
      value={color}
      oninput={(e) => (color = e.currentTarget.value)}
    />
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Linked note</div>
    <div class="setting-item-description">Obsidian note to link</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="Regions/dark-forest"
      value={note}
      oninput={(e) => (note = e.currentTarget.value)}
    />
    <button onclick={browseNote}>Browse</button>
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Description</div>
    <div class="setting-item-description">Short description shown in the sidebar</div>
  </div>
  <div class="setting-item-control">
    <textarea
      placeholder="A dense, ancient forest..."
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    ></textarea>
  </div>
</div>

{#if onLinkLocalMap}
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Local Map</div>
      <div class="setting-item-description">Link a drill-down map to this region</div>
    </div>
    <div class="setting-item-control">
      {#if localMapId}
        <span class="fantasy-map-linked-label">Linked</span>
        <button onclick={handleLinkLocalMap}>Change</button>
      {:else}
        <button onclick={handleLinkLocalMap}>Link Local Map</button>
      {/if}
    </div>
  </div>
{/if}

{#if !isEdit && layerOptions.length > 0}
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Layer</div>
      <div class="setting-item-description">Which layer to add this region to</div>
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
      {isEdit ? "Save" : "Add Region"}
    </button>
  </div>
</div>
