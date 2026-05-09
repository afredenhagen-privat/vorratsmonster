<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/authStore.js';

const router = useRouter();
const auth = useAuthStore();
const { sendingMagicLink, magicLinkSentTo, error, configured } = storeToRefs(auth);

const email = ref('');

const canSubmit = computed(
  () => configured.value && !sendingMagicLink.value && /\S+@\S+\.\S+/.test(email.value)
);

async function submit() {
  if (!canSubmit.value) return;
  try {
    await auth.signInWithMagicLink(email.value);
  } catch {
    /* error wird im Store gehalten */
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col gap-4 p-4">
    <header class="flex items-center gap-2">
      <button class="btn-secondary text-xs" @click="router.back()">← Zurück</button>
      <h1 class="text-xl font-semibold">Geräte teilen</h1>
    </header>

    <div class="card flex flex-col gap-3">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Logge dich auf beiden Geräten mit derselben E-Mail-Adresse ein.
        Deine Vorräte synchronisieren sich dann live zwischen beiden.
      </p>

      <p
        v-if="!configured"
        class="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100"
      >
        Sync ist gerade nicht konfiguriert (keine Supabase-URL/Key).
        Die App läuft lokal weiter.
      </p>

      <template v-else-if="!magicLinkSentTo">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium">E-Mail</span>
          <input
            v-model="email"
            type="email"
            class="input"
            inputmode="email"
            autocomplete="email"
            placeholder="dein@beispiel.de"
          />
        </label>

        <p
          v-if="error"
          class="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100"
        >
          {{ error }}
        </p>

        <button
          class="btn-primary"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ sendingMagicLink ? 'Sende…' : 'Magic-Link senden' }}
        </button>
      </template>

      <template v-else>
        <p
          class="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100"
        >
          Wir haben dir einen Link an <strong>{{ magicLinkSentTo }}</strong>
          geschickt. Öffne den Link auf diesem Gerät, dann bist du eingeloggt.
        </p>
        <button class="btn-secondary" @click="auth.magicLinkSentTo = null">
          Andere E-Mail
        </button>
      </template>
    </div>
  </div>
</template>
