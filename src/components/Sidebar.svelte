<script lang="ts">
  import type { SidebarState } from 'src/types';
  import { icon } from 'src/utils';

  interface Props {
    registerUpdate: (fn: (state: SidebarState | null) => void) => void;
  }

  let { registerUpdate }: Props = $props();
  let selected = $state<SidebarState | null>(null);
  let noteContentEl = $state<HTMLElement | null>(null);
  let noteLoading = $state(false);
  let noteError = $state(false);
  let noteExpanded = $state(false);
  let descriptionExpanded = $state(false);

  const DESCRIPTION_THRESHOLD = 200;

  $effect(() => {
    registerUpdate((state) => {
      selected = state;
      noteLoading = false;
      noteError = false;
      noteExpanded = false;
      descriptionExpanded = false;
    });
  });

  $effect(() => {
    const s = selected;
    if (!s?.properties.note) return;
    const el = noteContentEl;
    if (!el) return;
    noteLoading = true;
    noteError = false;
    void s.onReadNote(s.properties.note).then((content) => {
      noteLoading = false;
      if (content !== null) {
        s.onRenderMarkdown(content, el);
      } else {
        noteError = true;
      }
    });
  });
</script>

<div class="fantasy-map-sidebar-content">
  {#if selected}
    <div class="sidebar-sections">
      <div class="sidebar-header">
        <h3 class="sidebar-marker-title">
          {selected.properties.name}
        </h3>
        {#if selected.properties.description}
          <p
            class="sidebar-marker-description"
            class:line-clamped={!descriptionExpanded &&
              selected.properties.description.length > DESCRIPTION_THRESHOLD}
          >
            {selected.properties.description}
          </p>
          {#if selected.properties.description.length > DESCRIPTION_THRESHOLD}
            <button
              class="sidebar-text-link sidebar-toggle"
              onclick={() => (descriptionExpanded = !descriptionExpanded)}
              >{descriptionExpanded ? "Show less" : "Show more"}</button
            >
          {/if}
        {/if}
      </div>
      <div class="sidebar-buttons">
        <button class="fantasy-map-btn" onclick={() => selected?.onEdit()}>
          <span use:icon={"pencil"}></span>
          Edit
        </button>
        <button
          class="fantasy-map-btn fantasy-map-btn-danger"
          onclick={() => selected?.onDelete()}
        >
          <span use:icon={"trash-2"}></span>
          Delete
        </button>
        <button
          class="fantasy-map-btn"
          onclick={() => selected?.onAddRelation()}
        >
          <span use:icon={"link"}></span>
          Relation
        </button>
      </div>
      {#if selected.onOpenLocalMap}
        <button
          class="sidebar-text-link"
          onclick={() => selected?.onOpenLocalMap?.()}
        >
          <span use:icon={"map"}></span>
          Open Local Map
        </button>
      {/if}
      {#if selected.properties.note}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-header">
            <div class="sidebar-detail-label fm-section-label">Main note</div>
            <a
              href={selected.properties.note}
              aria-label="Open full note in new tab"
              onclick={(e) => {
                e.preventDefault();
                selected?.onOpenNote(selected.properties.note);
              }}>Open</a
            >
          </div>
          {#if noteLoading}
            <p class="sidebar-note-loading">Loading...</p>
          {:else if noteError}
            <p class="sidebar-note-error">Note not found</p>
          {/if}
          <div
            class="sidebar-note-content"
            class:collapsed={!noteExpanded}
            bind:this={noteContentEl}
          ></div>
          {#if !noteLoading && !noteError}
            <button
              class="sidebar-text-link sidebar-toggle"
              onclick={() => (noteExpanded = !noteExpanded)}
              >{noteExpanded ? "Show less" : "Show more"}</button
            >
          {/if}
        </div>
      {/if}

      {#if selected.properties.notes && selected.properties.notes.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label fm-section-label">Related notes</div>
          <div class="sidebar-note-links">
            {#each selected.properties.notes as notePath (notePath)}
              <a
                href={notePath}
                onclick={(e) => {
                  e.preventDefault();
                  selected?.onOpenNote(notePath);
                }}>{notePath}</a
              >
            {/each}
          </div>
        </div>
      {/if}

      {#if selected.properties.tags && selected.properties.tags.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label fm-section-label">Tags</div>
          <div class="sidebar-tag-list">
            {#each selected.properties.tags as tag (tag)}
              <button
                class="fm-tag sidebar-tag"
                onclick={() => selected?.onSearchTag(tag)}>{tag}</button
              >
            {/each}
          </div>
        </div>
      {/if}

      {#if selected.relations && selected.relations.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label fm-section-label">Relations</div>
          <div class="sidebar-relation-list">
            {#each selected.relations as rel (rel.featureId)}
              <div class="sidebar-relation-item">
                {#if rel.label}
                  <span class="sidebar-relation-label">{rel.label}</span>
                {/if}
                <button
                  class="sidebar-text-link sidebar-relation-name"
                  onclick={() => selected?.onSelectFeature(rel.featureId)}
                  >{rel.featureName}</button
                >
                <button
                  class="sidebar-relation-remove fm-remove-btn"
                  onclick={() => selected?.onRemoveRelation(rel.featureId)}
                  aria-label="Remove relation"
                >
                  <span use:icon={"x"}></span>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if selected.incomingRelations && selected.incomingRelations.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label fm-section-label">Referenced by</div>
          <div class="sidebar-relation-list">
            {#each selected.incomingRelations as rel (rel.featureId)}
              <div class="sidebar-relation-item">
                {#if rel.label}
                  <span class="sidebar-relation-label">{rel.label}</span>
                {/if}
                <button
                  class="sidebar-text-link sidebar-relation-name"
                  onclick={() => selected?.onSelectFeature(rel.featureId)}
                  >{rel.featureName}</button
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Top-level column — wide gap separates major sections */
  .sidebar-sections {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
    overflow-wrap: break-word;
  }

  /* Title + optional description */
  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-2);
  }

  .sidebar-marker-title {
    margin: 0;
    font-size: var(--font-ui-medium);
    color: var(--text-accent);
  }

  .sidebar-marker-description {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .sidebar-marker-description.line-clamped {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }

  /* Link-styled button for non-navigation actions */
  .sidebar-text-link {
    display: inline-flex;
    align-items: center;
    gap: var(--size-2-1);
    background: none;
    border: none;
    text-decoration: var(--link-decoration);
    text-decoration-thickness: var(--link-decoration-thickness);
    box-shadow: none;
    padding: 0;
    font: inherit;
    color: var(--link-color);
    cursor: pointer;
  }

  .sidebar-text-link:hover {
    color: var(--link-color-hover);
    background: none;
    text-decoration: var(--link-decoration-hover);
  }

  .sidebar-toggle {
    justify-content: end;
    font-size: var(--font-smallest);
    color: var(--text-muted);
  }

  .sidebar-toggle:hover {
    color: var(--text-normal);
  }

  .sidebar-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-4-2);
  }

  /* Detail section: label + content as a column */
  .sidebar-detail-section {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .sidebar-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* .fm-section-label provides typography */
  .sidebar-detail-label {
    margin: 0;
  }

  .sidebar-note-content {
    font-size: var(--font-ui-smaller);
    line-height: var(--line-height-normal);
    border-left: 2px solid var(--background-modifier-border);
    padding-left: var(--size-4-2);
  }

  .sidebar-note-content.collapsed {
    max-height: 10em;
    overflow: hidden;
  }

  .sidebar-note-loading,
  .sidebar-note-error {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin: 0;
  }

  .sidebar-note-error {
    color: var(--text-error);
  }

  .sidebar-note-links {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-3);
  }

  .sidebar-tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-4-1);
  }

  /* .fm-tag provides base; sidebar tags are clickable so get hover */
  .sidebar-tag {
    display: inline-block;
  }

  .sidebar-tag:hover {
    background: var(--background-modifier-border-hover);
    color: var(--text-normal);
  }

  .sidebar-relation-list {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .sidebar-relation-item {
    display: flex;
    align-items: center;
    gap: var(--size-2-3);
    font-size: 0.9em;
  }

  .sidebar-relation-label {
    color: var(--text-muted);
    font-size: 0.85em;
    font-style: italic;
  }

  /* .fm-remove-btn provides background, border, color, cursor, hover */
  .sidebar-relation-remove {
    margin-left: auto;
    padding: var(--size-2-1);
    display: flex;
    align-items: center;
    box-shadow: none;
  }
</style>
