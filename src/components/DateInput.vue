<script setup>
import { ref, watch, computed } from 'vue';
import { parseDate, formatDeDate } from '../utils/parseDate.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  required: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

// raw = was im Eingabefeld steht. Wir halten es separat, damit der User
// "15.05" tippen kann, ohne dass wir das ständig zu "15.05.2026" umschreiben.
const raw = ref(props.modelValue ? formatDeDate(props.modelValue) : '');
const dateInputRef = ref(null);

watch(
  () => props.modelValue,
  (next) => {
    // Selbst-emittiert (raw-Inhalt parsed bereits zum gleichen Wert) →
    // nichts tun.
    if (parseDate(raw.value) === next) return;
    // Wir haben gerade einen leeren modelValue bekommen, aber das
    // Eingabefeld ist nicht leer → der User tippt eine unfertige Eingabe
    // (z.B. "31.0" oder "1602.20"). Nicht überschreiben — sonst leert
    // sich das Feld mitten in der Eingabe.
    if (!next && raw.value.trim() !== '') return;
    raw.value = next ? formatDeDate(next) : '';
  }
);

const parsed = computed(() => parseDate(raw.value));
const isValid = computed(() => parsed.value !== null);
const isEmpty = computed(() => raw.value.trim() === '');

const inputClass = computed(() => {
  if (isEmpty.value) return 'input';
  if (isValid.value) return 'input border-green-500 focus:border-green-500 focus:ring-green-500';
  return 'input border-red-500 focus:border-red-500 focus:ring-red-500';
});

function onInput(e) {
  raw.value = e.target.value;
  emit('update:modelValue', parsed.value ?? '');
}

function openPicker() {
  if (dateInputRef.value?.showPicker) {
    dateInputRef.value.showPicker();
  } else {
    dateInputRef.value?.click();
  }
}

function onPick(e) {
  const iso = e.target.value;
  if (iso) {
    raw.value = formatDeDate(iso);
    emit('update:modelValue', iso);
  }
}
</script>

<template>
  <div class="relative">
    <input
      :class="inputClass"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="z. B. 15.05.2026, 15.05 oder 15052026"
      :value="raw"
      :required="required"
      @input="onInput"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-accent-600 dark:text-slate-400"
      title="Datums-Picker öffnen"
      @click="openPicker"
    >
      📅
    </button>
    <!-- Hidden native picker: liefert YYYY-MM-DD bei Auswahl -->
    <input
      ref="dateInputRef"
      type="date"
      class="sr-only"
      tabindex="-1"
      :value="modelValue"
      @input="onPick"
    />
    <p
      v-if="!isEmpty && isValid"
      class="mt-1 text-xs text-green-700 dark:text-green-400"
    >
      → {{ formatDeDate(modelValue) }}
    </p>
    <p
      v-else-if="!isEmpty && !isValid"
      class="mt-1 text-xs text-red-700 dark:text-red-400"
    >
      Ungültiges Datum
    </p>
  </div>
</template>
