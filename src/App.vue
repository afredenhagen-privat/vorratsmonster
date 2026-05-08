<script setup>
import { onMounted } from 'vue';
import { useInventoryStore } from './stores/inventoryStore.js';
import UndoSnackbar from './components/UndoSnackbar.vue';

const inventory = useInventoryStore();
onMounted(async () => {
  if (!inventory.loaded) await inventory.load();
});
</script>

<template>
  <div class="min-h-full">
    <RouterView />
    <UndoSnackbar />
  </div>
</template>
