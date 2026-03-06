<script lang="ts">
  import type { MarkerProperties, PolygonProperties } from "../types";

  interface SidebarState {
    featureType: "marker" | "polygon";
    properties: MarkerProperties | PolygonProperties;
    onOpenNote: (path: string) => void;
    onReadNote: (path: string) => Promise<string | null>;
    onRenderMarkdown: (markdown: string, el: HTMLElement) => void;
    onSearchTag: (tag: string) => void;
    onEdit: () => void;
    onDelete: () => void;
    onOpenLocalMap?: () => void;
    onLinkLocalMap?: () => void;
    relations?: { featureId: string; featureName: string; label: string }[];
  }

  interface Props {
    registerUpdate: (fn: (state: SidebarState | null) => void) => void;
  }

  let { registerUpdate }: Props = $props();
  let selected = $state<SidebarState | null>(null);
  let noteContentEl: HTMLElement | null = $state(null);
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
    const el = noteContentEl;
    if (s?.properties.note && el) {
      noteLoading = true;
      noteError = false;
      s.onReadNote(s.properties.note).then((content) => {
        noteLoading = false;
        if (content != null && noteContentEl) {
          s.onRenderMarkdown(content, noteContentEl);
        } else {
          noteError = true;
        }
      });
    }
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
        {#if getIcon(selected)}{getIcon(selected)}{" "}{/if}{selected.properties
          .name}
      </h3>
      {#if selected.properties.description}
        <p class="sidebar-marker-description">
          {selected.properties.description}
        </p>
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
          {#each selected.properties.notes as notePath}
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
            {#each selected.properties.tags as tag}
              <button
                class="sidebar-tag"
                onclick={() => selected?.onSearchTag(tag)}
              >{tag}</button>
            {/each}
          </div>
        </div>
      {/if}

      {#if selected.relations && selected.relations.length > 0}
        <div class="sidebar-detail-section">
          <div class="sidebar-detail-label">Relations</div>
          <div class="sidebar-relation-list">
            {#each selected.relations as rel}
              <div class="sidebar-relation-item">
                <span class="sidebar-relation-name">{rel.featureName}</span>
                {#if rel.label}
                  <span class="sidebar-relation-label">{rel.label}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
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
