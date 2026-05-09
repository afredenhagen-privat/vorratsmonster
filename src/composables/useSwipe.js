import { ref, onBeforeUnmount } from 'vue';

/**
 * Touch-only Swipe-Detector. Liefert Reactive-Flags für left/right-Wisch
 * und Helper, die an Touch-Events gebunden werden.
 *
 * Aufruf:
 *   const { onTouchStart, onTouchMove, onTouchEnd, dx } = useSwipe({
 *     threshold: 80,
 *     onSwipeRight: () => ...,
 *     onSwipeLeft: () => ...
 *   });
 *
 * `dx` ist während des Drags verfügbar (für „translate" auf dem Element,
 * damit der Nutzer Feedback bekommt).
 */
export function useSwipe({ threshold = 80, onSwipeRight, onSwipeLeft } = {}) {
  const startX = ref(0);
  const startY = ref(0);
  const dx = ref(0);
  const tracking = ref(false);

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    tracking.value = true;
    startX.value = e.touches[0].clientX;
    startY.value = e.touches[0].clientY;
    dx.value = 0;
  }

  function onTouchMove(e) {
    if (!tracking.value) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startX.value;
    const deltaY = t.clientY - startY.value;
    // Wenn sich vertikal mehr bewegt als horizontal → Scroll-Geste, wir
    // tracken nicht weiter.
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      tracking.value = false;
      dx.value = 0;
      return;
    }
    dx.value = deltaX;
  }

  function onTouchEnd() {
    if (!tracking.value) {
      dx.value = 0;
      return;
    }
    if (dx.value > threshold && onSwipeRight) onSwipeRight();
    else if (dx.value < -threshold && onSwipeLeft) onSwipeLeft();
    tracking.value = false;
    dx.value = 0;
  }

  onBeforeUnmount(() => {
    tracking.value = false;
  });

  return { onTouchStart, onTouchMove, onTouchEnd, dx, tracking };
}
