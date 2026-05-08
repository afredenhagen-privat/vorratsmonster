<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { LOCATION_LABELS, LOCATIONS } from '../db/schema.js';
import ExpiryBadge from '../components/ExpiryBadge.vue';

const inventory = useInventoryStore();
const ui = useUiStore();
const { filterLocation, searchQuery } = storeToRefs(ui);

const visible = computed(() =>
  inventory.filtered({
    query: searchQuery.value,
    location: filterLocation.value
  })
);

const filterChips = [
  { key: null, label: 'Alle' },
  ...LOCATIONS.map((k) => ({ key: k, label: LOCATION_LABELS[k] }))
];

function chipClass(key) {
  return key === filterLocation.value
    ? 'chip bg-accent-600 text-white'
    : 'chip bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-3 p-4 pb-32">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Vorrat</h1>
      <RouterLink
        to="/item/new?manual=1"
        class="btn-secondary text-xs"
        title="Manuell anlegen"
      >
        + Manuell
      </RouterLink>
    </header>

    <input
      class="input"
      type="search"
      placeholder="Suchen…"
      :value="searchQuery"
      @input="ui.setSearchQuery($event.target.value)"
    />

    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in filterChips"
        :key="String(c.key)"
        :class="chipClass(c.key)"
        @click="ui.setLocationFilter(c.key)"
      >
        {{ c.label }}
      </button>
    </div>

    <ul v-if="visible.length" class="flex flex-col gap-2">
      <li v-for="item in visible" :key="item.id">
        <RouterLink
          :to="{ name: 'item-detail', params: { id: item.id } }"
          class="card flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <img
            v-if="item.image_url"
            :src="item.image_url"
            class="h-12 w-12 rounded object-cover"
            alt=""
          />
          <div
            v-else
            class="flex h-12 w-12 items-center justify-center rounded bg-slate-200 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            ohne Bild
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">
              {{ item.name }}
              <span class="text-xs text-slate-500 dark:text-slate-400"
                >· {{ item.quantity }} Stk</span
              >
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              {{ LOCATION_LABELS[item.location] }} · MHD
              {{ formatDate(item.best_before) }}
            </div>
          </div>
          <ExpiryBadge :best-before="item.best_before" />
        </RouterLink>
      </li>
    </ul>

    <div
      v-else
      class="card mt-8 text-center text-sm text-slate-500 dark:text-slate-400"
    >
      Noch keine Vorräte. Tipp auf <strong>+ Scannen</strong> oder
      <strong>+ Manuell</strong>.
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4"
      style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))"
    >
      <RouterLink
        to="/scan"
        class="btn-primary px-6 py-3 text-base shadow-lg"
        title="Barcode scannen"
      >
        + Scannen
      </RouterLink>
    </div>
  </div>
</template>

<script>
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
</script>
