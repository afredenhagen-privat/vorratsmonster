<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useProductCacheStore } from '../stores/productCacheStore.js';
import { LOCATIONS, LOCATION_LABELS } from '../db/schema.js';
import NameAutocomplete from '../components/NameAutocomplete.vue';

const props = defineProps({
  barcode: { type: String, default: null },
  manual: { type: Boolean, default: false },
  editId: { type: String, default: null }
});

const router = useRouter();
const inventory = useInventoryStore();
const productCache = useProductCacheStore();

const form = ref({
  barcode: props.barcode,
  name: '',
  brand: null,
  image_url: null,
  category: null,
  quantity: 1,
  best_before: defaultBestBefore(),
  location: 'fridge'
});
const loading = ref(false);
const lookupFailed = ref(false);

const isEdit = computed(() => Boolean(props.editId));
const title = computed(() =>
  isEdit.value ? 'Eintrag bearbeiten' : 'Neuer Eintrag'
);

onMounted(async () => {
  if (isEdit.value) {
    if (!inventory.loaded) await inventory.load();
    const existing = inventory.byId(props.editId);
    if (existing) {
      form.value = { ...form.value, ...pickEditFields(existing) };
    }
    return;
  }
  if (props.barcode) {
    loading.value = true;
    const product = await productCache.lookup(props.barcode);
    loading.value = false;
    if (product) {
      form.value.name = product.name ?? '';
      form.value.brand = product.brand;
      form.value.image_url = product.image_url;
      form.value.category = product.category;
    } else {
      lookupFailed.value = true;
    }
  }
});

async function save() {
  if (!form.value.name.trim()) return;
  if (isEdit.value) {
    await inventory.update(props.editId, form.value);
    router.replace({ name: 'item-detail', params: { id: props.editId } });
  } else {
    await inventory.create(form.value);
    router.replace({ name: 'inventory' });
  }
}

function defaultBestBefore() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function pickEditFields(item) {
  return {
    barcode: item.barcode,
    name: item.name,
    brand: item.brand,
    image_url: item.image_url,
    category: item.category,
    quantity: item.quantity,
    best_before: item.best_before,
    location: item.location
  };
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
    <header class="flex items-center gap-2">
      <button class="btn-secondary text-xs" @click="router.back()">
        ← Zurück
      </button>
      <h1 class="text-xl font-semibold">{{ title }}</h1>
    </header>

    <p
      v-if="lookupFailed"
      class="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100"
    >
      Barcode <code>{{ barcode }}</code> ist Open Food Facts unbekannt. Bitte
      Name manuell eingeben.
    </p>

    <p v-if="loading" class="text-sm text-slate-500">Suche Produkt…</p>

    <img
      v-if="form.image_url"
      :src="form.image_url"
      class="h-32 w-32 self-center rounded-lg object-cover"
      :alt="form.name"
    />

    <label class="flex flex-col gap-1">
      <span class="text-sm font-medium">Name</span>
      <NameAutocomplete
        v-if="manual && !isEdit"
        v-model="form.name"
        :suggestions="inventory.distinctManualNames"
      />
      <input v-else v-model="form.name" type="text" class="input" />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-sm font-medium">Menge (Stück)</span>
      <input
        v-model.number="form.quantity"
        type="number"
        min="1"
        class="input"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-sm font-medium">MHD</span>
      <input v-model="form.best_before" type="date" class="input" required />
    </label>

    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm font-medium">Lagerort</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="loc in LOCATIONS"
          :key="loc"
          type="button"
          class="chip px-3 py-1.5 text-sm"
          :class="
            form.location === loc
              ? 'bg-accent-600 text-white'
              : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
          "
          @click="form.location = loc"
        >
          {{ LOCATION_LABELS[loc] }}
        </button>
      </div>
    </fieldset>

    <button
      class="btn-primary mt-4 w-full"
      :disabled="!form.name.trim()"
      @click="save"
    >
      Speichern
    </button>
  </div>
</template>
