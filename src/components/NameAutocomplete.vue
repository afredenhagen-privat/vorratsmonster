<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'z. B. Kartoffeln' }
});
const emit = defineEmits(['update:modelValue']);

const focused = ref(false);

const filtered = computed(() => {
  const q = props.modelValue.trim().toLowerCase();
  if (!q) return props.suggestions.slice(0, 6);
  return props.suggestions
    .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
    .slice(0, 6);
});

function pick(name) {
  emit('update:modelValue', name);
  focused.value = false;
}

function onBlur() {
  // Verzögert ausblenden, damit ein @mousedown auf einer Suggestion noch
  // greifen kann, bevor das Dropdown verschwindet.
  setTimeout(() => {
    focused.value = false;
  }, 150);
}
</script>

<template>
  <div class="relative">
    <input
      class="input"
      type="text"
      autocomplete="off"
      :placeholder="placeholder"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      @focus="focused = true"
      @blur="onBlur"
    />
    <ul
      v-if="focused && filtered.length"
      class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <li
        v-for="name in filtered"
        :key="name"
        class="cursor-pointer px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        @mousedown.prevent="pick(name)"
      >
        {{ name }}
      </li>
    </ul>
  </div>
</template>
