<script setup>
import { computed, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { LOCATION_LABELS } from '../db/schema.js';
import { formatDeDate } from '../utils/parseDate.js';
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

async function toggleOpened() {
  if (!item.value) return;
  const id = item.value.id;
  const wasOpened = item.value.is_opened;
  const wasOpenedAt = item.value.opened_at;
  await inventory.toggleOpened(id);
  ui.showSnackbar({
    message: item.value.is_opened
      ? 'Als angebrochen markiert.'
      : 'Anbruch zurückgesetzt.',
    action: {
      label: 'Rückgängig',
      handler: async () => {
        await inventory.setOpened(id, wasOpened, wasOpenedAt);
      }
    }
  });
}

async function freeze() {
  if (!item.value) return;
  const id = item.value.id;
  const { snapshot } = await inventory.freeze(id);
  ui.showSnackbar({
    message: `Eingefroren · MHD +6 Monate (${formatDeDate(item.value.best_before)}).`,
    action: {
      label: 'Rückgängig',
      handler: async () => {
        await inventory.restoreSnapshot(id, snapshot);
      }
    }
  });
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
        <dd>{{ formatDeDate(item.best_before) }}</dd>
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

    <!-- Status -->
    <div class="card flex items-center justify-between gap-3">
      <div class="text-sm">
        <div class="font-medium">Status</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ item.is_opened ? `angebrochen seit ${formatDeDate((item.opened_at ?? '').slice(0,10))}` : 'ungeöffnet' }}
        </div>
      </div>
      <button
        type="button"
        class="chip px-3 py-1.5 text-sm"
        :class="
          item.is_opened
            ? 'bg-amber-500 text-white'
            : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
        "
        @click="toggleOpened"
      >
        {{ item.is_opened ? '● Angebrochen' : '○ Angebrochen markieren' }}
      </button>
    </div>

    <!-- Aktionen -->
    <div class="flex flex-wrap gap-2">
      <RouterLink
        :to="{ name: 'item-edit', params: { id: item.id } }"
        class="btn-secondary flex-1 min-w-[120px]"
      >
        Bearbeiten
      </RouterLink>
      <button
        v-if="item.location !== 'freezer'"
        type="button"
        class="btn-secondary flex-1 min-w-[120px]"
        @click="freeze"
      >
        ❄ Einfrieren
      </button>
      <button class="btn-danger flex-1 min-w-[120px]" @click="consume">
        Verbrauchen
      </button>
    </div>
  </div>
  <div v-else class="p-4 text-sm text-slate-500">Eintrag nicht gefunden.</div>
</template>
