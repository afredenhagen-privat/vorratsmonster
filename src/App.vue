<script setup>
import { onMounted } from 'vue';
import { useInventoryStore } from './stores/inventoryStore.js';
import { useShelfLifeStore } from './stores/shelfLifeStore.js';
import UndoSnackbar from './components/UndoSnackbar.vue';

const inventory = useInventoryStore();
const shelfLife = useShelfLifeStore();
onMounted(async () => {
  if (!inventory.loaded) await inventory.load();
  if (!shelfLife.loaded) await shelfLife.load();
});
</script>

<template>
  <div class="min-h-full">
    <RouterView />
    <UndoSnackbar />
  </div>
</template>
