<script lang="ts">
  import type { FantasyMapSettings, MapConfig, LayerConfig } from "../types";

  interface Props {
    settings: FantasyMapSettings;
    onSave: () => Promise<void>;
    onDeleteLayer: (mapId: string, layerId: string) => Promise<void>;
  }

  let { settings, onSave, onDeleteLayer }: Props = $props();

  function addMap() {
    const newMap: MapConfig = {
      id: crypto.randomUUID(),
      name: "",
      mapImagePath: "",
      layers: [],
      defaultLayerId: "",
    };
    settings.maps = [...settings.maps, newMap];
    void onSave();
  }

  function removeMap(mapId: string) {
    settings.maps = settings.maps.filter((m) => m.id !== mapId);
    void onSave();
  }

  function addLayer(map: MapConfig) {
    const newLayer: LayerConfig = {
      id: crypto.randomUUID(),
      name: "New Layer",
    };
    map.layers = [...map.layers, newLayer];
    settings.maps = [...settings.maps];
    void onSave();
  }

  async function removeLayer(map: MapConfig, layerId: string) {
    await onDeleteLayer(map.id, layerId);
    map.layers = map.layers.filter((l) => l.id !== layerId);
    if (map.defaultLayerId === layerId) {
      map.defaultLayerId = "";
    }
    settings.maps = [...settings.maps];
    void onSave();
  }
</script>

<div class="setting-item setting-item-heading">
  <div class="setting-item-info">
    <div class="setting-item-name">Maps</div>
  </div>
</div>

{#each settings.maps as map (map.id)}
  <div class="fantasy-map-config-section">
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Map name</div>
        <div class="setting-item-description">Display name for this map</div>
      </div>
      <div class="setting-item-control">
        <input
          type="text"
          placeholder="World map"
          value={map.name}
          oninput={(e) => {
            map.name = e.currentTarget.value;
            void onSave();
          }}
        />
        <button
          class="mod-warning"
          onclick={() => removeMap(map.id)}
        >
          Remove
        </button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Map image path</div>
        <div class="setting-item-description">
          Path to the PNG image in your vault (e.g. maps/world.png)
        </div>
      </div>
      <div class="setting-item-control">
        <input
          type="text"
          placeholder="maps/world.png"
          value={map.mapImagePath}
          oninput={(e) => {
            map.mapImagePath = e.currentTarget.value;
            void onSave();
          }}
        />
      </div>
    </div>

    <div class="setting-item setting-item-heading">
      <div class="setting-item-info">
        <div class="setting-item-name">Layers</div>
      </div>
    </div>

    {#each map.layers as layer (layer.id)}
      <div class="setting-item">
        <div class="setting-item-control">
          <input
            type="text"
            placeholder="Layer name"
            value={layer.name}
            oninput={(e) => {
              layer.name = e.currentTarget.value;
              void onSave();
            }}
          />
          <button
            class="mod-warning"
            onclick={() => void removeLayer(map, layer.id)}
          >
            Remove
          </button>
        </div>
      </div>
    {/each}

    <div class="setting-item">
      <div class="setting-item-control">
        <button onclick={() => addLayer(map)}>Add layer</button>
      </div>
    </div>

    {#if map.layers.length > 0}
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Default layer</div>
          <div class="setting-item-description">
            Layer used by default when adding new markers
          </div>
        </div>
        <div class="setting-item-control">
          <select
            value={map.defaultLayerId}
            onchange={(e) => {
              map.defaultLayerId = e.currentTarget.value;
              void onSave();
            }}
          >
            <option value="">— none —</option>
            {#each map.layers as layer (layer.id)}
              <option value={layer.id}>{layer.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}
  </div>
{/each}

<div class="setting-item">
  <div class="setting-item-control">
    <button class="mod-cta" onclick={addMap}>Add map</button>
  </div>
</div>
