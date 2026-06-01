<script lang="ts">
  import type { SidebarState } from "../types";
  import { icon } from "../utils";

  interface Props {
    registerUpdate: (fn: (state: SidebarState | null) => void) => void;
  }

  let { registerUpdate }: Props = $props();
  let selected = $state<SidebarState | null>(null);
  let noteContentEl = $state<HTMLElement | null>(null);
  let noteLoading = $state(false);
  let noteError = $state(false);

  $effect(() => {
    registerUpdate((state) => {
      selected = state;
      noteLoading = false;
      noteError = false;
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
      <div>
        <h3 class="sidebar-marker-title">
          {selected.properties.name}
        </h3>
        {#if selected.properties.description}
          <p class="sidebar-marker-description">
            {selected.properties.description}
          </p>
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
        <button class="fantasy-map-btn" onclick={() => selected?.onAddRelation()}>
          <span use:icon={"link"}></span>
          Relation
        </button>
      </div>
      {#if selected.onOpenLocalMap}
        <button
          class="fantasy-map-btn"
          onclick={() => selected?.onOpenLocalMap?.()}
        >
          <span use:icon={"map"}></span>
          Open Local Map
        </button>
      {/if}
      {#if selected.properties.note}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-header">
            <div class="sidebar-detail-label">Main note</div>
            <button
              class="sidebar-note-link"
              onclick={() => selected?.onOpenNote(selected.properties.note)}
            >
              Open
            </button>
          </div>
          {#if noteLoading}
            <p class="sidebar-note-loading">Loading...</p>
          {:else if noteError}
            <p class="sidebar-note-error">Note not found</p>
          {/if}
          <div class="sidebar-note-content" bind:this={noteContentEl}></div>
        </div>
      {/if}

      {#if selected.properties.notes && selected.properties.notes.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label">Related notes</div>
          {#each selected.properties.notes as notePath (notePath)}
            <button
              class="sidebar-note-link"
              onclick={() => selected?.onOpenNote(notePath)}
            >
              {notePath}
            </button>
          {/each}
        </div>
      {/if}

      {#if selected.properties.tags && selected.properties.tags.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label">Tags</div>
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
          <div class="sidebar-detail-label">Relations</div>
          <div class="sidebar-relation-list">
            {#each selected.relations as rel (rel.featureId)}
              <div class="sidebar-relation-item">
                {#if rel.label}
                  <span class="sidebar-relation-label">{rel.label}</span>
                {/if}
                <span class="sidebar-relation-name">{rel.featureName}</span>
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
          <div class="sidebar-detail-label">Referenced by</div>
          <div class="sidebar-relation-list">
            {#each selected.incomingRelations as rel (rel.featureId)}
              <div class="sidebar-relation-item">
                {#if rel.label}
                  <span class="sidebar-relation-label">{rel.label}</span>
                {/if}
                <span class="sidebar-relation-name">{rel.featureName}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sidebar-relation-list {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
  }

  .sidebar-relation-item {
    display: flex;
    align-items: center;
    gap: var(--size-2-3);
    font-size: 0.9em;
  }

  .sidebar-relation-name {
    color: var(--text-normal);
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
