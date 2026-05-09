import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUndoStore } from '../stores/undoStore.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('undoStore.push / pop', () => {
  it('push erhöht count, pop führt undoFn aus und entfernt Eintrag', async () => {
    const undo = useUndoStore();
    let called = 0;
    undo.push({ description: 'Test', undoFn: () => (called += 1) });
    expect(undo.count).toBe(1);
    expect(undo.topDescription).toBe('Test');
    const desc = await undo.pop();
    expect(desc).toBe('Test');
    expect(called).toBe(1);
    expect(undo.count).toBe(0);
  });

  it('pop auf leerem Stack liefert null und ruft nichts auf', async () => {
    const undo = useUndoStore();
    const desc = await undo.pop();
    expect(desc).toBeNull();
  });

  it('LIFO-Reihenfolge', async () => {
    const undo = useUndoStore();
    const order = [];
    undo.push({ description: 'A', undoFn: () => order.push('A') });
    undo.push({ description: 'B', undoFn: () => order.push('B') });
    undo.push({ description: 'C', undoFn: () => order.push('C') });
    await undo.pop();
    await undo.pop();
    await undo.pop();
    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('Stack ist auf 10 begrenzt — älteste fallen unten raus', async () => {
    const undo = useUndoStore();
    for (let i = 0; i < 15; i++) {
      undo.push({ description: `${i}`, undoFn: () => {} });
    }
    expect(undo.count).toBe(10);
    expect(undo.topDescription).toBe('14');
  });

  it('async undoFn wird awaited', async () => {
    const undo = useUndoStore();
    let done = false;
    undo.push({
      description: 'Async',
      undoFn: async () => {
        await new Promise((r) => setTimeout(r, 10));
        done = true;
      }
    });
    await undo.pop();
    expect(done).toBe(true);
  });

  it('Fehler in undoFn werden geschluckt — Stack bleibt konsistent', async () => {
    const undo = useUndoStore();
    undo.push({
      description: 'Boom',
      undoFn: () => {
        throw new Error('nope');
      }
    });
    const desc = await undo.pop();
    expect(desc).toBe('Boom');
    expect(undo.count).toBe(0);
  });

  it('clear leert den Stack', async () => {
    const undo = useUndoStore();
    undo.push({ description: 'X', undoFn: () => {} });
    undo.clear();
    expect(undo.count).toBe(0);
  });

  it('push verlangt eine Funktion als undoFn', () => {
    const undo = useUndoStore();
    expect(() => undo.push({ description: 'X', undoFn: null })).toThrow();
  });
});
