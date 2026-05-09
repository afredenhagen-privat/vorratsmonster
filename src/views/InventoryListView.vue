<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink, useRouter } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { LOCATION_LABELS, LOCATIONS } from '../db/schema.js';
import InventoryItem from '../components/InventoryItem.vue';
import SyncStatus from '../components/SyncStatus.vue';

const router = useRouter();
const inventory = useInventoryStore();
const ui = useUiStore();
const { filterLocation, filterOpened, filterBarcode, searchQuery } =
  storeToRefs(ui);

const visible = computed(() =>
  inventory.filtered({
    query: searchQuery.value,
    location: filterLocation.value,
    opened: filterOpened.value,
    barcode: filterBarcode.value
  })
);

const filterChips = [
  { key: null, label: 'Alle' },
  ...LOCATIONS.map((k) => ({ key: k, label: LOCATION_LABELS[k] }))
];

function locationChipClass(key) {
  return key === filterLocation.value
    ? 'chip bg-accent-600 text-white'
    : 'chip bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
}

const openedChipClass = computed(() =>
  filterOpened.value
    ? 'chip bg-amber-500 text-white'
    : 'chip bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
);

function openScanFilter() {
  router.push({ path: '/scan', query: { mode: 'filter' } });
}

function clearBarcodeFilter() {
  ui.setBarcodeFilter(null);
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-3 p-4 pb-32">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold">Vorrat</h1>
      <div class="flex items-center gap-2">
        <SyncStatus />
        <RouterLink to="/item/new?manual=1" class="btn-secondary text-xs">
          + Manuell
        </RouterLink>
      </div>
    </header>

    <div class="flex items-center gap-2">
      <input
        class="input flex-1"
        type="search"
        placeholder="Suchen…"
        :value="searchQuery"
        @input="ui.setSearchQuery($event.target.value)"
      />
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-base hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
        title="Per Scan suchen"
        @click="openScanFilter"
      >
        📷
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="c in filterChips"
        :key="String(c.key)"
        :class="locationChipClass(c.key)"
        @click="ui.setLocationFilter(c.key)"
      >
        {{ c.label }}
      </button>
      <button :class="openedChipClass" @click="ui.setOpenedFilter(!filterOpened)">
        Angebrochen
      </button>
      <span
        v-if="filterBarcode"
        class="chip bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
      >
        Barcode: {{ filterBarcode }}
        <button class="ml-2 font-bold" @click="clearBarcodeFilter">✕</button>
      </span>
    </div>

    <ul v-if="visible.length" class="flex flex-col gap-2">
      <li v-for="item in visible" :key="item.id">
        <InventoryItem :item="item" />
      </li>
    </ul>

    <div
      v-else
      class="card mt-8 text-center text-sm text-slate-500 dark:text-slate-400"
    >
      Keine Treffer. Tipp auf <strong>+ Scannen</strong> oder
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
