<script lang="ts">
  interface Props {
    onBrowseImage: (cb: (path: string) => void) => void;
    onSubmit: (name: string, imagePath: string) => void;
  }

  let { onBrowseImage, onSubmit }: Props = $props();

  let name = $state("");
  let imagePath = $state("");
  let error = $state("");

  function clearError() {
    if (error) error = "";
  }

  function handleSubmit() {
    if (!name.trim()) {
      error = "Map name is required";
      return;
    }
    if (!imagePath.trim()) {
      error = "Map image is required";
      return;
    }
    error = "";
    onSubmit(name.trim(), imagePath.trim());
  }

  function browseImage() {
    onBrowseImage((path) => {
      imagePath = path;
      if (!name) {
        name = path.split("/").pop()?.replace(/\.\w+$/, "") ?? "";
      }
    });
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
<h2>Create New Map</h2>

<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Name</div>
    <div class="setting-item-description">Display name for the map</div>
  </div>
  <div class="setting-item-control">
    <input
      type="text"
      placeholder="The Known World"
      value={name}
      oninput={(e) => { name = e.currentTarget.value; clearError(); }}
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
      placeholder="maps/world.png"
      value={imagePath}
      oninput={(e) => { imagePath = e.currentTarget.value; clearError(); }}
    />
    <button type="button" onclick={browseImage}>Browse</button>
  </div>
</div>

{#if error}
  <p class="fantasy-map-form-error">{error}</p>
{/if}

<div class="setting-item">
  <div class="setting-item-control">
    <button type="submit" class="mod-cta">Create Map</button>
  </div>
</div>
</form>
