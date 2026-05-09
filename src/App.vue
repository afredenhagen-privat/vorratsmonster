<script setup>
import { onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useInventoryStore } from './stores/inventoryStore.js';
import { useShelfLifeStore } from './stores/shelfLifeStore.js';
import { useAuthStore } from './stores/authStore.js';
import { useSyncStore } from './stores/syncStore.js';
import UndoSnackbar from './components/UndoSnackbar.vue';
import UndoFab from './components/UndoFab.vue';

const inventory = useInventoryStore();
const shelfLife = useShelfLifeStore();
const auth = useAuthStore();
const sync = useSyncStore();
const { isSignedIn } = storeToRefs(auth);

onMounted(async () => {
  // Local-First: Dexie laden, danach erst Auth/Sync — UI ist sofort da.
  if (!inventory.loaded) await inventory.load();
  if (!shelfLife.loaded) await shelfLife.load();

  await auth.init();
  await sync.init();
  if (auth.isSignedIn) {
    sync.onSignIn().then(async () => {
      await inventory.reload();
      await shelfLife.reload();
    });
  }

  // Realtime-Events vom Sync-Store: relevante Stores neu laden.
  window.addEventListener('vm:remote-change', async (e) => {
    const table = e.detail?.table;
    if (table === 'items') await inventory.reload();
    else if (table === 'shelf_life_presets') await shelfLife.reload();
    // my_products hat keinen reactive State → nichts zu tun
  });
});

// Reagiere auf Login/Logout während der Session
watch(isSignedIn, async (now, before) => {
  if (now && !before) {
    await sync.onSignIn();
    await inventory.reload();
    await shelfLife.reload();
  } else if (!now && before) {
    await sync.onSignOut();
  }
});
</script>

<template>
  <div class="min-h-full">
    <RouterView />
    <UndoFab />
    <UndoSnackbar />
  </div>
</template>
