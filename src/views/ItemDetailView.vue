<script setup>
import { computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { LOCATION_LABELS } from '../db/schema.js';
import ExpiryBadge from '../components/ExpiryBadge.vue';

const props = defineProps({
  id: { type: String, required: true }
});

const router = useRouter();
const inventory = useInventoryStore();
const ui = useUiStore();

const item = computed(() => inventory.byId(props.id));

onMounted(async () => {
  if (!inventory.loaded) await inventory.load();
});

async function consume() {
  if (!item.value) return;
  const id = item.value.id;
  const name = item.value.name;
  await inventory.softDelete(id);
  ui.showSnackbar({
    message: `"${name}" verbraucht.`,
    action: {
      label: 'Rückgängig',
      handler: async () => {
        await inventory.restore(id);
      }
    }
  });
  router.replace({ name: 'inventory' });
}
</script>

<template>
  <div v-if="item" class="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
    <header class="flex items-center gap-2">
      <button class="btn-secondary text-xs" @click="router.back()">← Zurück</button>
      <h1 class="text-xl font-semibold">Eintrag</h1>
    </header>

    <img
      v-if="item.image_url"
      :src="item.image_url"
      class="h-40 w-40 self-center rounded-lg object-cover"
      :alt="item.name"
    />

    <div class="card flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">{{ item.name }}</h2>
        <ExpiryBadge :best-before="item.best_before" />
      </div>
      <p v-if="item.brand" class="text-sm text-slate-500 dark:text-slate-400">
        {{ item.brand }}
      </p>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt class="text-slate-500">Menge</dt>
        <dd>{{ item.quantity }} Stk</dd>
        <dt class="text-slate-500">MHD</dt>
        <dd>{{ formatDate(item.best_before) }}</dd>
        <dt class="text-slate-500">Lagerort</dt>
        <dd>{{ LOCATION_LABELS[item.location] }}</dd>
        <template v-if="item.barcode">
          <dt class="text-slate-500">Barcode</dt>
          <dd><code>{{ item.barcode }}</code></dd>
        </template>
        <template v-if="item.category">
          <dt class="text-slate-500">Kategorie</dt>
          <dd>{{ item.category }}</dd>
        </template>
      </dl>
    </div>

    <div class="flex gap-2">
      <RouterLink
        :to="{ name: 'item-edit', params: { id: item.id } }"
        class="btn-secondary flex-1"
      >
        Bearbeiten
      </RouterLink>
      <button class="btn-danger flex-1" @click="consume">Verbrauchen</button>
    </div>
  </div>
  <div v-else class="p-4 text-sm text-slate-500">Eintrag nicht gefunden.</div>
</template>

<script>
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
</script>
