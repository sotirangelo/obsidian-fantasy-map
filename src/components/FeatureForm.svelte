<script lang="ts">
  import { untrack } from "svelte";
  import type { MarkerProperties, PolygonProperties } from "../types";

  type FeatureType = "marker" | "polygon";

  interface Props {
    featureType: FeatureType;
    initialProperties: MarkerProperties | PolygonProperties;
    layerOptions: { id: string; name: string }[];
    initialLayerId: string;
    isEdit: boolean;
    onBrowseNote: (cb: (path: string) => void) => void;
    onBrowseTag: (cb: (tag: string) => void) => void;
    onLinkLocalMap?: (cb: (mapId: string) => void) => void;
    onSubmit: (properties: MarkerProperties | PolygonProperties, layerId: string) => void;
  }

  let {
    featureType,
    initialProperties,
    layerOptions,
    initialLayerId,
    isEdit,
    onBrowseNote,
    onBrowseTag,
    onLinkLocalMap,
    onSubmit,
  }: Props = $props();

  const label = untrack(() => featureType === "marker" ? "Marker" : "Region");

  let name = $state(untrack(() => initialProperties.name));
  let note = $state(untrack(() => initialProperties.note));
  let description = $state(untrack(() => initialProperties.description));
  let localMapId = $state(untrack(() => initialProperties.localMapId ?? ""));
  let selectedLayerId = $state(untrack(() => initialLayerId));
  let notes = $state<string[]>(untrack(() => [...(initialProperties.notes ?? [])]));
  let tags = $state<string[]>(untrack(() => [...(initialProperties.tags ?? [])]));
  let tagInput = $state("");
  let error = $state("");

  let icon = $state(
    untrack(() => (featureType === "marker" ? (initialProperties as MarkerProperties).icon : "")),
  );
  let color = $state(
    untrack(() => (featureType === "polygon" ? initialProperties.color : "")),
  );

  function handleSubmit() {
    if (!name.trim()) {
      error = `${label} name is required`;
      return;
    }
    error = "";

    const filteredNotes = notes.filter((n) => n.trim());
    const filteredTags = tags.filter((t) => t.trim());

    const base = {
      id: initialProperties.id,
      name: name.trim(),
      note,
      description,
      localMapId: localMapId || undefined,
      notes: filteredNotes.length > 0 ? filteredNotes : undefined,
      tags: filteredTags.length > 0 ? filteredTags : undefined,
    };

    if (featureType === "marker") {
      onSubmit(
        { ...base, icon, color: (initialProperties as MarkerProperties).color } as MarkerProperties,
        selectedLayerId,
      );
    } else {
      onSubmit({ ...base, color } as PolygonProperties, selectedLayerId);
    }
  }

  function browseMainNote() {
    onBrowseNote((path) => {
      note = path;
    });
  }

  function browseAdditionalNote(index: number) {
    onBrowseNote((path) => {
      notes[index] = path;
    });
  }

  function addNote() {
    notes.push("");
  }

  function removeNote(index: number) {
    notes.splice(index, 1);
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      tags.push(trimmed);
      tagInput = "";
    }
  }

  function browseTag() {
    onBrowseTag((tag) => {
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(index: number) {
    tags.splice(index, 1);
  }

  function handleLinkLocalMap() {
    onLinkLocalMap?.((mapId) => {
      localMapId = mapId;
    });
  }
</script>

<h2>{isEdit ? `Edit ${label}` : `Add ${label}`}</h2>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Name</div>
    <div class="setting-item-description">Display name for the {label.toLowerCase()}</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder={featureType === "marker" ? "Waterdeep" : "The Dark Forest"}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
    />
  </div>
</div>

{#if featureType === "marker"}
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
{/if}

{#if featureType === "polygon"}
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
{/if}

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Description</div>
    <div class="setting-item-description">Short description shown in the {featureType === "marker" ? "popup" : "sidebar"}</div>
  </div>
  <div class="setting-item-control">
    <textarea
      placeholder={featureType === "marker"
        ? "A bustling port city on the sword coast"
        : "A dense, ancient forest..."}
      value={description}
      oninput={(e) => (description = e.currentTarget.value)}
    ></textarea>
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Main note</div>
    <div class="setting-item-description">Primary Obsidian note linked to this {label.toLowerCase()}</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder={featureType === "marker" ? "Cities/waterdeep" : "Regions/dark-forest"}
      value={note}
      oninput={(e) => (note = e.currentTarget.value)}
    />
    <button onclick={browseMainNote}>Browse</button>
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Additional notes</div>
    <div class="setting-item-description">Other Obsidian notes related to this {label.toLowerCase()}</div>
  </div>
  <div class="setting-item-control fantasy-map-notes-control">
    {#each notes as n, i (i)}
      <div class="fantasy-map-note-row">
        <input
          type="text"
          placeholder="Path/to/note"
          value={n}
          oninput={(e) => (notes[i] = e.currentTarget.value)}
        />
        <button onclick={() => browseAdditionalNote(i)}>Browse</button>
        <button class="fantasy-map-btn-remove" onclick={() => removeNote(i)}>×</button>
      </div>
    {/each}
    <button onclick={addNote}>+ Add note</button>
  </div>
</div>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Tags</div>
    <div class="setting-item-description">Tags for categorization</div>
  </div>
  <div class="setting-item-control fantasy-map-tags-control">
    {#if tags.length > 0}
      <div class="fantasy-map-tag-list">
        {#each tags as tag, i (i)}
          <span class="fantasy-map-tag">
            {tag}
            <button class="fantasy-map-tag-remove" onclick={() => removeTag(i)}>×</button>
          </span>
        {/each}
      </div>
    {/if}
    <div class="fantasy-map-tag-input-row">
      <input
        type="text"
        placeholder="Add a tag..."
        value={tagInput}
        oninput={(e) => (tagInput = e.currentTarget.value)}
        onkeydown={handleTagKeydown}
      />
      <button onclick={addTag}>Add</button>
      <button onclick={browseTag}>Browse tags</button>
    </div>
  </div>
</div>

{#if onLinkLocalMap}
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Local Map</div>
      <div class="setting-item-description">Link a drill-down map to this {label.toLowerCase()}</div>
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
      <div class="setting-item-description">
        Which layer to add this {label.toLowerCase()} to
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
      {isEdit ? "Save" : `Add ${label}`}
    </button>
  </div>
</div>
