<script setup>
import { storeToRefs } from 'pinia';
import { useUndoStore } from '../stores/undoStore.js';
import { useUiStore } from '../stores/uiStore.js';

const undo = useUndoStore();
const ui = useUiStore();
const { count, topDescription } = storeToRefs(undo);

async function onClick() {
  const desc = await undo.pop();
  if (desc) {
    ui.showSnackbar({ message: `Rückgängig: ${desc}` });
  }
}
</script>

<template>
  <button
    v-if="count > 0"
    class="fixed right-4 z-40 flex items-center gap-1 rounded-full bg-slate-900/85 px-3 py-2 text-sm text-white shadow-lg backdrop-blur dark:bg-slate-700/85"
    style="top: calc(0.75rem + env(safe-area-inset-top))"
    :title="`Letzte Aktion rückgängig machen (${count} im Stack): ${topDescription}`"
    @click="onClick"
  >
    <span class="text-base">↺</span>
    <span class="text-xs font-semibold tabular-nums">{{ count }}</span>
  </button>
</template>
