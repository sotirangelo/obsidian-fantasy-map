<script lang="ts">
  interface Props {
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { title, description, onConfirm, onCancel }: Props = $props();
</script>

<h2>{title}</h2>
<p>{description}</p>
<div class="setting-item">
  <div class="setting-item-control">
    <button class="pressable" onclick={onCancel}>Cancel</button>
    <button class="pressable mod-warning" onclick={onConfirm}>Delete</button>
  </div>
</div>

<style>
  .pressable {
    cursor: pointer;
  }
</style>
