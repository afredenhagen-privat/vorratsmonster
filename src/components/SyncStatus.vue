<script setup>
import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';
import { useSyncStore } from '../stores/syncStore.js';

const auth = useAuthStore();
const sync = useSyncStore();
const { email, configured } = storeToRefs(auth);
const { statusKind, pending } = storeToRefs(sync);

const expanded = ref(false);

const label = computed(() => {
  switch (statusKind.value) {
    case 'synced':
      return '🟢 Synchron';
    case 'syncing':
      return `🟡 Sync (${pending.value})`;
    case 'offline':
      return '🔴 Offline';
    case 'signed-out':
      return 'Geräte teilen?';
    case 'local':
    default:
      return null; // Sync nicht konfiguriert: gar nichts anzeigen
  }
});

function toggle() {
  expanded.value = !expanded.value;
}

async function logout() {
  await auth.signOut();
  await sync.onSignOut();
  expanded.value = false;
}
</script>

<template>
  <div v-if="label" class="relative inline-block">
    <RouterLink
      v-if="statusKind === 'signed-out'"
      to="/login"
      class="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      {{ label }}
    </RouterLink>
    <button
      v-else
      class="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      @click="toggle"
    >
      {{ label }}
    </button>

    <div
      v-if="expanded"
      class="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
    >
      <div class="text-sm">
        <div class="font-medium">{{ email ?? 'Eingeloggt' }}</div>
        <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Status: {{ label }}
        </div>
      </div>
      <button class="btn-secondary mt-3 w-full text-xs" @click="logout">
        Abmelden
      </button>
    </div>
  </div>
</template>
