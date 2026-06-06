<script lang="ts">
  import { untrack } from "svelte";
  import * as v from "valibot";
  import type { MarkerProperties, PolygonProperties } from 'src/types';
  import { FeatureRingSchema } from 'src/schemas';
  import { icon } from 'src/utils';

  interface RelationEntry {
    featureId: string;
    featureName: string;
    label: string;
  }

  type FeatureType = "marker" | "polygon";

  interface Props {
    featureType: FeatureType;
    initialProperties: MarkerProperties | PolygonProperties;
    layerOptions: { id: string; name: string }[];
    initialLayerId: string;
    isEdit: boolean;
    scaleUnit?: string;
    onBrowseNote: (cb: (path: string) => void) => void;
    onBrowseTag: (cb: (tag: string) => void) => void;
    onLinkLocalMap?: (cb: (mapId: string) => void) => void;
    allFeatures?: { id: string; name: string }[];
    onBrowseFeature?: (
      cb: (featureId: string, featureName: string) => void,
    ) => void;
    onSubmit: (
      properties: MarkerProperties | PolygonProperties,
      layerId: string,
    ) => void;
  }

  let {
    featureType,
    initialProperties,
    layerOptions,
    initialLayerId,
    isEdit,
    scaleUnit,
    onBrowseNote,
    onBrowseTag,
    onLinkLocalMap,
    allFeatures = [],
    onBrowseFeature,
    onSubmit,
  }: Props = $props();

  const radiusUnit = $derived(scaleUnit ?? "px");

  const label = untrack(() => (featureType === "marker" ? "Marker" : "Region"));

  let name = $state(untrack(() => initialProperties.name));
  let note = $state(untrack(() => initialProperties.note));
  let description = $state(untrack(() => initialProperties.description));
  let localMapId = $state(untrack(() => initialProperties.localMapId ?? ""));
  let selectedLayerId = $state(untrack(() => initialLayerId));
  let notes = $state<string[]>(
    untrack(() => [...(initialProperties.notes ?? [])]),
  );
  let tags = $state<string[]>(
    untrack(() => [...(initialProperties.tags ?? [])]),
  );
  let tagInput = $state("");
  let error = $state("");

  function clearError() {
    if (error) error = "";
  }

  let relations = $state<RelationEntry[]>(
    untrack(() =>
      (initialProperties.relations ?? []).map((r) => ({
        featureId: r.featureId,
        featureName:
          allFeatures.find((f) => f.id === r.featureId)?.name ?? r.featureId,
        label: r.label,
      })),
    ),
  );

  let color = $state(untrack(() => initialProperties.color));

  let ringEnabled = $state(untrack(() => initialProperties.ring !== undefined));
  let ringColor = $state(
    untrack(() => initialProperties.ring?.color ?? "#ffffff"),
  );
  let ringRadius = $state(untrack(() => initialProperties.ring?.radius ?? 50));

  function handleSubmit() {
    if (!name.trim()) {
      error = `${label} name is required`;
      return;
    }

    let ring: { color: string; radius: number } | undefined;
    if (ringEnabled) {
      const parsed = v.safeParse(FeatureRingSchema, {
        color: ringColor,
        radius: ringRadius,
      });
      if (!parsed.success) {
        error = parsed.issues[0].message;
        return;
      }
      ring = parsed.output;
    }

    error = "";

    const filteredNotes = notes.filter((n) => n.trim());
    const filteredTags = tags.filter((t) => t.trim());
    const filteredRelations = relations
      .filter((r) => r.featureId)
      .map(({ featureId, label }) => ({ featureId, label }));

    onSubmit(
      {
        id: initialProperties.id,
        name: name.trim(),
        note,
        description,
        color,
        localMapId: localMapId || undefined,
        notes: filteredNotes.length > 0 ? filteredNotes : undefined,
        tags: filteredTags.length > 0 ? filteredTags : undefined,
        relations: filteredRelations.length > 0 ? filteredRelations : undefined,
        ring,
      },
      selectedLayerId,
    );
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

  function addRelation() {
    onBrowseFeature?.((featureId, featureName) => {
      relations.push({ featureId, featureName, label: "" });
    });
  }

  function removeRelation(index: number) {
    relations.splice(index, 1);
  }

  function handleLinkLocalMap() {
    onLinkLocalMap?.((mapId) => {
      localMapId = mapId;
    });
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Name</div>
      <div class="setting-item-description">
        Display name for the {label.toLowerCase()}
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        placeholder={featureType === "marker" ? "Waterdeep" : "The Dark Forest"}
        value={name}
        oninput={(e) => {
          name = e.currentTarget.value;
          clearError();
        }}
      />
    </div>
  </div>

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Color</div>
      <div class="setting-item-description">
        {featureType === "marker"
          ? "Marker color"
          : "Fill color for the region"}
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="color"
        value={color}
        oninput={(e) => (color = e.currentTarget.value)}
      />
    </div>
  </div>

  <div class="setting-item setting-item--stacked">
    <div class="setting-item-info">
      <div class="setting-item-name">Ring radius ({radiusUnit})</div>
      <div class="setting-item-description">
        Optional area around the {label.toLowerCase()}{scaleUnit
          ? `, in ${scaleUnit} (from map scale)`
          : ", in pixels (set a map scale to use real-world units)"}
      </div>
    </div>
    <div class="setting-item-control">
      <label class="fantasy-map-ring-toggle">
        <input
          type="checkbox"
          checked={ringEnabled}
          onchange={(e) => (ringEnabled = e.currentTarget.checked)}
        />
        Enable
      </label>
      {#if ringEnabled}
        <input
          type="color"
          aria-label="Ring color"
          value={ringColor}
          oninput={(e) => (ringColor = e.currentTarget.value)}
        />
        <input
          type="number"
          aria-label={`Ring radius in ${radiusUnit}`}
          value={ringRadius}
          oninput={(e) => {
            const n = Number(e.currentTarget.value);
            if (Number.isFinite(n)) ringRadius = n;
          }}
        />
        <span class="fantasy-map-ring-unit">{radiusUnit}</span>
      {/if}
    </div>
  </div>

  <div class="setting-item setting-item--stacked">
    <div class="setting-item-info">
      <div class="setting-item-name">Description</div>
      <div class="setting-item-description">
        Short description shown in the {featureType === "marker"
          ? "popup"
          : "sidebar"}
      </div>
    </div>
    <div class="setting-item-control">
      <textarea
        class="fantasy-map-description-textarea"
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
      <div class="setting-item-description">
        Primary Obsidian note linked to this {label.toLowerCase()}
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        placeholder={featureType === "marker"
          ? "Cities/waterdeep"
          : "Regions/dark-forest"}
        value={note}
        oninput={(e) => (note = e.currentTarget.value)}
      />
      <button type="button" class="fantasy-map-btn" onclick={browseMainNote}
        >Browse</button
      >
    </div>
  </div>

  <div class="setting-item setting-item--stacked">
    <div class="setting-item-info">
      <div class="setting-item-name">Additional notes</div>
      <div class="setting-item-description">
        Other Obsidian notes related to this {label.toLowerCase()}
      </div>
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
          <button
            type="button"
            class="fantasy-map-btn"
            onclick={() => browseAdditionalNote(i)}>Browse</button
          >
          <button
            type="button"
            class="fm-remove-btn"
            onclick={() => removeNote(i)}
            aria-label="Remove note"
            use:icon={"x"}
          >
          </button>
        </div>
      {/each}
      <button type="button" onclick={addNote}>+ Add note</button>
    </div>
  </div>

  <div class="setting-item setting-item--stacked">
    <div class="setting-item-info">
      <div class="setting-item-name">Tags</div>
      <div class="setting-item-description">Tags for categorization</div>
    </div>
    <div class="setting-item-control fantasy-map-tags-control">
      {#if tags.length > 0}
        <div class="fantasy-map-tag-list">
          {#each tags as tag, i (i)}
            <span class="fm-tag fantasy-map-tag">
              {tag}
              <button
                type="button"
                class="fantasy-map-tag-remove fm-remove-btn"
                aria-label="Remove tag"
                onclick={() => removeTag(i)}
                use:icon={"x"}
              >
              </button>
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
        <button
          type="button"
          class="fantasy-map-btn"
          onclick={addTag}
          disabled={!tagInput.trim()}>Add</button
        >
        <button type="button" class="fantasy-map-btn" onclick={browseTag}
          >Browse tags</button
        >
      </div>
    </div>
  </div>

  {#if onBrowseFeature}
    <div class="setting-item setting-item--stacked">
      <div class="setting-item-info">
        <div class="setting-item-name">Relations</div>
        <div class="setting-item-description">
          Features related to this {label.toLowerCase()}
        </div>
      </div>
      <div class="setting-item-control fantasy-map-relations-control">
        {#each relations as rel, i (i)}
          <div class="fantasy-map-relation-row">
            <input
              type="text"
              placeholder="Relationship type..."
              value={rel.label}
              oninput={(e) => (rel.label = e.currentTarget.value)}
            />
            <span class="fantasy-map-relation-name">{rel.featureName}</span>
            <button
              type="button"
              class="fm-remove-btn"
              onclick={() => removeRelation(i)}
              aria-label="Remove relation"
              use:icon={"x"}
            >
            </button>
          </div>
        {/each}
        <button type="button" onclick={addRelation}>+ Add relation</button>
      </div>
    </div>
  {/if}

  {#if onLinkLocalMap}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Local Map</div>
        <div class="setting-item-description">
          Link a drill-down map to this {label.toLowerCase()}
        </div>
      </div>
      <div class="setting-item-control">
        {#if localMapId}
          <span class="fantasy-map-linked-label">Already Linked</span>
          <button type="button" onclick={handleLinkLocalMap}>Change</button>
        {:else}
          <button type="button" onclick={handleLinkLocalMap}
            >Link Local Map</button
          >
        {/if}
      </div>
    </div>
  {/if}

  {#if layerOptions.length > 0}
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Layer</div>
        <div class="setting-item-description">
          {isEdit
            ? `Move this ${label.toLowerCase()} to a different layer`
            : `Which layer to add this ${label.toLowerCase()} to`}
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
      <button type="submit" class="mod-cta">
        {isEdit ? "Save" : `Add ${label}`}
      </button>
    </div>
  </div>
</form>

<style>
  .setting-item--stacked {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-item--stacked .setting-item-control {
    justify-content: flex-start;
    flex-wrap: wrap;
    width: 100%;
  }

  .fantasy-map-relation-name {
    font-size: 0.9em;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fantasy-map-linked-label {
    color: var(--text-success);
    font-size: 0.9em;
  }

  .fantasy-map-description-textarea {
    width: 100%;
    min-height: 5em;
    resize: vertical;
  }

  .fantasy-map-ring-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    font-size: 0.9em;
  }

  .fantasy-map-ring-unit {
    font-size: 0.8em;
    color: var(--text-muted);
  }

  :global(.setting-item-control:has(.fantasy-map-ring-toggle)) {
    gap: var(--size-4-2);
  }

  :global(.setting-item-control:has(.fantasy-map-ring-toggle))
    > input[type="number"] {
    width: 5em;
  }
</style>
