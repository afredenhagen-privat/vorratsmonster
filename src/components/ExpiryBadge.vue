<script setup>
import { computed } from 'vue';
import { expiryLevel, daysUntil } from '../db/schema.js';

const props = defineProps({
  bestBefore: { type: String, required: true }
});

const level = computed(() => expiryLevel(props.bestBefore));

const label = computed(() => {
  const days = daysUntil(props.bestBefore);
  if (days < 0) return `abgelaufen (${-days} d)`;
  if (days === 0) return 'läuft heute ab';
  if (days === 1) return 'läuft morgen ab';
  return `${days} Tage`;
});

const cls = computed(() => `badge-expiry-${level.value}`);
</script>

<template>
  <span :class="cls">{{ label }}</span>
</template>
