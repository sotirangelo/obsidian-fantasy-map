<script lang="ts">
  interface LayerEntry {
    id: string;
    name: string;
    featureCount: number;
  }

  interface Props {
    initialLayers: LayerEntry[];
    onAdd: (id: string, name: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
  }

  let { initialLayers, onAdd, onRename, onDelete }: Props = $props();

  let layers = $state<LayerEntry[]>([...initialLayers]);
  let newLayerName = $state("");
  let editingId = $state<string | null>(null);
  let editingName = $state("");
  let deletingId = $state<string | null>(null);

  function startEdit(layer: LayerEntry) {
    deletingId = null;
    editingId = layer.id;
    editingName = layer.name;
  }

  function saveEdit() {
    const name = editingName.trim();
    if (!editingId) return;
    if (name && name !== layers.find((l) => l.id === editingId)?.name) {
      const id = editingId;
      layers = layers.map((l) => (l.id === id ? { ...l, name } : l));
      onRename(id, name);
    }
    editingId = null;
  }

  function cancelEdit() {
    editingId = null;
  }

  function startDelete(layer: LayerEntry) {
    editingId = null;
    deletingId = layer.id;
  }

  function confirmDelete() {
    if (!deletingId) return;
    const id = deletingId;
    layers = layers.filter((l) => l.id !== id);
    onDelete(id);
    deletingId = null;
  }

  function cancelDelete() {
    deletingId = null;
  }

  function handleAdd() {
    const name = newLayerName.trim();
    if (!name) return;
    const id = window.crypto.randomUUID();
    layers = [...layers, { id, name, featureCount: 0 }];
    newLayerName = "";
    onAdd(id, name);
  }

  function plural(n: number, word: string) {
    return `${n.toString()} ${word}${n === 1 ? "" : "s"}`;
  }
</script>

<h2>Manage Layers</h2>

<div class="manage-layers-list">
  {#if layers.length === 0}
    <p class="manage-layers-empty">No layers yet.</p>
  {/if}

  {#each layers as layer (layer.id)}
    <div class="manage-layers-row">
      {#if deletingId === layer.id}
        <span class="manage-layers-confirm-text">
          Delete "{layer.name}"{layer.featureCount > 0
            ? ` and its ${plural(layer.featureCount, "feature")}`
            : ""}?
        </span>
        <div class="manage-layers-actions">
          <button class="mod-warning" onclick={confirmDelete}>Delete</button>
          <button onclick={cancelDelete}>Cancel</button>
        </div>
      {:else if editingId === layer.id}
        <input
          class="manage-layers-name-input"
          bind:value={editingName}
          onkeydown={(e) => {
            if (e.key === "Enter") saveEdit();
            else if (e.key === "Escape") cancelEdit();
          }}
        />
        <div class="manage-layers-actions">
          <button class="mod-cta" onclick={saveEdit}>Save</button>
          <button onclick={cancelEdit}>Cancel</button>
        </div>
      {:else}
        <div class="manage-layers-info">
          <span class="manage-layers-name">{layer.name}</span>
          <span class="manage-layers-count">
            {layer.featureCount > 0
              ? plural(layer.featureCount, "feature")
              : "empty"}
          </span>
        </div>
        <div class="manage-layers-actions">
          <button onclick={() => startEdit(layer)}>Rename</button>
          <button class="mod-warning" onclick={() => startDelete(layer)}
            >Delete</button
          >
        </div>
      {/if}
    </div>
  {/each}
</div>

<div class="manage-layers-add">
  <input
    class="manage-layers-new-input"
    placeholder="New layer name…"
    bind:value={newLayerName}
    onkeydown={(e) => {
      if (e.key === "Enter") handleAdd();
    }}
  />
  <button
    class="mod-cta"
    onclick={handleAdd}
    disabled={!newLayerName.trim()}
  >
    Add Layer
  </button>
</div>

<style>
  .manage-layers-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
    min-height: 40px;
  }

  .manage-layers-empty {
    color: var(--text-muted);
    font-style: italic;
    margin: 8px 0;
  }

  .manage-layers-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    min-height: 36px;
  }

  .manage-layers-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .manage-layers-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .manage-layers-count {
    font-size: 0.8em;
    color: var(--text-muted);
  }

  .manage-layers-confirm-text {
    flex: 1;
    font-size: 0.9em;
    min-width: 0;
  }

  .manage-layers-name-input {
    flex: 1;
    min-width: 0;
  }

  .manage-layers-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .manage-layers-add {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .manage-layers-new-input {
    flex: 1;
  }
</style>
