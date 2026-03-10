<script lang="ts">
  import { untrack } from "svelte";
  import type { MapConfig } from "../types";

  interface Props {
    existingMaps: MapConfig[];
    onBrowseImage: (cb: (path: string) => void) => void;
    onSubmit: (mapId: string, isNew: boolean, name?: string, imagePath?: string) => void;
  }

  let { existingMaps, onBrowseImage, onSubmit }: Props = $props();

  let tab = $state<"new" | "existing">("new");

  // New map fields
  let newName = $state("");
  let newImagePath = $state("");

  // Existing map fields
  let selectedMapId = $state(untrack(() => existingMaps[0]?.id ?? ""));

  let error = $state("");

  function clearError() {
    if (error) error = "";
  }

  function handleSubmitNew() {
    if (!newName.trim()) {
      error = "Map name is required";
      return;
    }
    if (!newImagePath.trim()) {
      error = "Map image is required";
      return;
    }
    error = "";
    onSubmit(window.crypto.randomUUID(), true, newName.trim(), newImagePath.trim());
  }

  function handleSubmitExisting() {
    if (!selectedMapId) {
      error = "Please select a map";
      return;
    }
    error = "";
    onSubmit(selectedMapId, false);
  }

  function browseImage() {
    onBrowseImage((path) => {
      newImagePath = path;
      if (!newName) {
        newName = path.split("/").pop()?.replace(/\.\w+$/, "") ?? "";
      }
    });
  }
</script>

<h2>Link Local Map</h2>

<div class="fantasy-map-tabs">
  <button
    class="fantasy-map-tab {tab === 'new' ? 'is-active' : ''}"
    onclick={() => { tab = 'new'; error = ''; }}
  >New Map</button>
  <button
    class="fantasy-map-tab {tab === 'existing' ? 'is-active' : ''}"
    onclick={() => { tab = 'existing'; error = ''; }}
    disabled={existingMaps.length === 0}
  >Existing Map</button>
</div>

{#if tab === 'new'}
  <form onsubmit={(e) => { e.preventDefault(); handleSubmitNew(); }}>
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Name</div>
      <div class="setting-item-description">Display name for the local map</div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        placeholder="City of Waterdeep"
        value={newName}
        oninput={(e) => { newName = e.currentTarget.value; clearError(); }}
      />
    </div>
  </div>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Map image</div>
      <div class="setting-item-description">Image file from your vault</div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        placeholder="maps/waterdeep.png"
        value={newImagePath}
        oninput={(e) => { newImagePath = e.currentTarget.value; clearError(); }}
      />
      <button type="button" onclick={browseImage}>Browse</button>
    </div>
  </div>

  {#if error}
    <p class="fantasy-map-form-error">{error}</p>
  {/if}

  <div class="setting-item">
    <div class="setting-item-control">
      <button type="submit" class="mod-cta">Create & Link</button>
    </div>
  </div>
  </form>
{:else}
  {#if existingMaps.length === 0}
    <p class="setting-item-description">No linkable maps available.</p>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmitExisting(); }}>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Map</div>
        <div class="setting-item-description">Select an existing map to link</div>
      </div>
      <div class="setting-item-control">
        <select
          value={selectedMapId}
          onchange={(e) => (selectedMapId = e.currentTarget.value)}
        >
          {#each existingMaps as m (m.id)}
            <option value={m.id}>{m.name || m.id}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if error}
      <p class="fantasy-map-form-error">{error}</p>
    {/if}

    <div class="setting-item">
      <div class="setting-item-control">
        <button type="submit" class="mod-cta">Link Map</button>
      </div>
    </div>
    </form>
  {/if}
{/if}

<style>
  .fantasy-map-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1em;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .fantasy-map-tab {
    padding: 6px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.9em;
  }

  .fantasy-map-tab:hover {
    color: var(--text-normal);
  }

  .fantasy-map-tab.is-active {
    color: var(--text-accent);
    border-bottom-color: var(--text-accent);
  }

  .fantasy-map-tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
