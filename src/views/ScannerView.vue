<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const videoRef = ref(null);
const error = ref(null);
const supported = ref('BarcodeDetector' in window);
let stream = null;
let detector = null;
let rafId = null;
let stopped = false;

onMounted(async () => {
  if (!supported.value) return;
  try {
    detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
    });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
      tick();
    }
  } catch (e) {
    error.value = e.message || 'Kamera-Zugriff fehlgeschlagen.';
  }
});

onBeforeUnmount(() => {
  stopped = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach((t) => t.stop());
});

async function tick() {
  if (stopped || !detector || !videoRef.value) return;
  try {
    const codes = await detector.detect(videoRef.value);
    if (codes.length) {
      const code = codes[0].rawValue;
      if (navigator.vibrate) navigator.vibrate(120);
      stopped = true;
      router.replace({ name: 'item-new', query: { barcode: code } });
      return;
    }
  } catch {
    /* einzelne Fehler ignorieren, weiter scannen */
  }
  rafId = requestAnimationFrame(tick);
}

function manualFallback() {
  router.replace({ name: 'item-new', query: { manual: '1' } });
}
</script>

<template>
  <div class="relative h-screen w-full bg-black text-white">
    <button
      class="absolute left-4 top-4 z-10 rounded-full bg-black/60 px-3 py-1 text-sm"
      style="margin-top: env(safe-area-inset-top)"
      @click="router.back()"
    >
      ← Abbrechen
    </button>

    <video
      v-if="supported && !error"
      ref="videoRef"
      class="h-full w-full object-cover"
      muted
      playsinline
    />

    <div
      v-if="supported"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div class="h-40 w-72 rounded-xl border-2 border-accent-500/80" />
    </div>

    <div
      v-if="!supported || error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p v-if="!supported">
        Dieser Browser unterstützt das Scannen nicht. Auf Android Chrome geht
        es; auf iOS Safari leider nicht.
      </p>
      <p v-else>{{ error }}</p>
      <button class="btn-primary" @click="manualFallback">
        Manuell eingeben
      </button>
    </div>

    <button
      v-if="supported && !error"
      class="absolute inset-x-0 bottom-8 mx-auto block w-fit rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur"
      @click="manualFallback"
    >
      Lieber manuell eingeben
    </button>
  </div>
</template>
