<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { LOCATION_LABELS } from '../db/schema.js';
import { formatDeDate } from '../utils/parseDate.js';
import { useSwipe } from '../composables/useSwipe.js';
import ExpiryBadge from './ExpiryBadge.vue';

const props = defineProps({
  item: { type: Object, required: true }
});

const inventory = useInventoryStore();
const ui = useUiStore();

const transformStyle = computed(() => ({
  transform: dx.value !== 0 ? `translateX(${dx.value}px)` : '',
  transition: tracking.value ? 'none' : 'transform 0.18s ease'
}));

const { onTouchStart, onTouchMove, onTouchEnd, dx, tracking } = useSwipe({
  threshold: 80,
  onSwipeRight: () => toggleOpened(),
  onSwipeLeft: () => toggleOpened()
});

async function toggleOpened() {
  const id = props.item.id;
  const name = props.item.name;
  const wasOpened = props.item.is_opened;
  const wasOpenedAt = props.item.opened_at;
  const result = await inventory.toggleOpened(id);
  if (result.kind === 'split') {
    ui.queueUndoable(
      `1 Stück "${name}" als angebrochen abgelöst.`,
      async () => {
        await inventory.undoSplit(result.original.id, result.splitItem.id);
      },
      `Anbruch (${name})`
    );
  } else {
    ui.queueUndoable(
      result.item.is_opened ? 'Als angebrochen markiert.' : 'Anbruch zurückgesetzt.',
      async () => {
        await inventory.setOpened(id, wasOpened, wasOpenedAt);
      },
      `Anbruch-Toggle (${name})`
    );
  }
}

async function decrement() {
  const id = props.item.id;
  const name = props.item.name;
  const beforeQty = props.item.quantity;
  const result = await inventory.setQuantity(id, -1);
  if (result.kind === 'deleted') {
    ui.queueUndoable(
      `"${name}" verbraucht.`,
      async () => {
        await inventory.restore(id);
      },
      `Verbrauchen (${name})`
    );
  } else {
    ui.queueUndoable(
      `"${name}" auf ${result.item.quantity} reduziert.`,
      async () => {
        await inventory.setQuantity(id, beforeQty - result.item.quantity);
      },
      `Menge − (${name})`
    );
  }
}

async function increment() {
  const id = props.item.id;
  const name = props.item.name;
  await inventory.setQuantity(id, 1);
  ui.queueUndoable(
    `"${name}" auf ${props.item.quantity} erhöht.`,
    async () => {
      await inventory.setQuantity(id, -1);
    },
    `Menge + (${name})`
  );
}
</script>

<template>
  <div
    class="relative"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <RouterLink
      :to="{ name: 'item-detail', params: { id: item.id } }"
      class="card flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      :style="transformStyle"
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
          <span
            v-if="item.is_opened"
            class="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500"
            title="Angebrochen"
          />
          {{ item.name }}
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ LOCATION_LABELS[item.location] }} · MHD {{ formatDeDate(item.best_before) }}
        </div>
        <div class="mt-0.5">
          <ExpiryBadge :best-before="item.best_before" />
        </div>
      </div>

      <!-- Plus/Minus + Menge: stop propagation, sonst löst der RouterLink aus -->
      <div
        class="flex shrink-0 items-center gap-1"
        @click.prevent.stop
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
      >
        <button
          type="button"
          class="h-8 w-8 rounded-full bg-slate-200 text-base font-semibold text-slate-800 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
          title="Verbrauchen / Menge -1"
          @click="decrement"
        >
          −
        </button>
        <div class="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums">
          {{ item.quantity }}
        </div>
        <button
          type="button"
          class="h-8 w-8 rounded-full bg-slate-200 text-base font-semibold text-slate-800 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
          title="Menge +1"
          @click="increment"
        >
          +
        </button>
      </div>
    </RouterLink>
  </div>
</template>
