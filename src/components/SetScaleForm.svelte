<script lang="ts">
  interface Props {
    onSubmit: (realDistance: number, unit: string) => void;
  }

  let { onSubmit }: Props = $props();

  let distance = $state("");
  let unit = $state("km");
  let error = $state("");

  const UNITS = ["km", "miles", "m", "ft", "leagues"];

  function handleSubmit() {
    const d = parseFloat(distance);
    if (!distance || isNaN(d) || d <= 0) {
      error = "Please enter a valid positive distance";
      return;
    }
    error = "";
    onSubmit(d, unit);
  }
</script>

<h2>Set Map Scale</h2>
<p class="setting-item-description">
  Enter the real-world distance between the two points you selected.
</p>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Distance</div>
    <div class="setting-item-description">Real-world distance between the two calibration points</div>
  </div>
  <div class="setting-item-control">
    <input
      type="number"
      min="0.001"
      step="any"
      placeholder="100"
      value={distance}
      oninput={(e) => (distance = e.currentTarget.value)}
    />
    <select
      value={unit}
      onchange={(e) => (unit = e.currentTarget.value)}
    >
      {#each UNITS as u (u)}
        <option value={u}>{u}</option>
      {/each}
    </select>
  </div>
</div>

{#if error}
  <p class="fantasy-map-form-error">{error}</p>
{/if}

<div class="setting-item">
  <div class="setting-item-control">
    <button class="mod-cta" onclick={handleSubmit}>Save Scale</button>
  </div>
</div>
