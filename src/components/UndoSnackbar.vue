<script setup>
import { storeToRefs } from 'pinia';
import { useUiStore } from '../stores/uiStore.js';

const ui = useUiStore();
const { snackbar } = storeToRefs(ui);
</script>

<template>
  <Transition name="snack">
    <div
      v-if="snackbar"
      class="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg dark:bg-slate-800"
      style="margin-bottom: env(safe-area-inset-bottom)"
    >
      <span class="text-sm">{{ snackbar.message }}</span>
      <button
        v-if="snackbar.action"
        class="text-sm font-semibold text-accent-300 hover:text-accent-100"
        @click="ui.runSnackbarAction()"
      >
        {{ snackbar.action.label }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.snack-enter-active,
.snack-leave-active {
  transition: all 0.2s ease;
}
.snack-enter-from,
.snack-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
