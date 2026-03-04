<script lang="ts">
  interface Props {
    markerName: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { markerName, onConfirm, onCancel }: Props = $props();
</script>

<h2>Delete marker</h2>
<p>Are you sure you want to delete "{markerName}"?</p>
<div class="setting-item">
  <div class="setting-item-control">
    <button onclick={onCancel}>Cancel</button>
    <button class="mod-warning" onclick={onConfirm}>Delete</button>
  </div>
</div>
