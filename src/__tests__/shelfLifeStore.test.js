import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useShelfLifeStore } from '../stores/shelfLifeStore.js';
import { clearAllData } from '../db/database.js';

const today = new Date(2026, 4, 9); // 9. Mai 2026

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearAllData();
});

describe('shelfLifeStore.upsertFromItem', () => {
  it('berechnet days = MHD - heute und persistiert', async () => {
    const store = useShelfLifeStore();
    await store.load();
    await store.upsertFromItem('Kartoffeln', '2026-05-23', today);
    expect(store.daysFor('Kartoffeln')).toBe(14);
  });

  it('ist case-insensitiv beim Lookup', async () => {
    const store = useShelfLifeStore();
    await store.load();
    await store.upsertFromItem('Kartoffeln', '2026-05-23', today);
    expect(store.daysFor('kartoffeln')).toBe(14);
    expect(store.daysFor('KARTOFFELN')).toBe(14);
  });

  it('zweiter Aufruf überschreibt den Wert', async () => {
    const store = useShelfLifeStore();
    await store.load();
    await store.upsertFromItem('Bananen', '2026-05-15', today);
    expect(store.daysFor('Bananen')).toBe(6);
    await store.upsertFromItem('Bananen', '2026-05-12', today);
    expect(store.daysFor('Bananen')).toBe(3);
  });

  it('ignoriert MHD in der Vergangenheit (kaputtes Preset vermeiden)', async () => {
    const store = useShelfLifeStore();
    await store.load();
    await store.upsertFromItem('Joghurt', '2026-05-15', today);
    expect(store.daysFor('Joghurt')).toBe(6);
    await store.upsertFromItem('Joghurt', '2026-04-30', today);
    // Wert bleibt unverändert
    expect(store.daysFor('Joghurt')).toBe(6);
  });

  it('persistiert über reload', async () => {
    const store = useShelfLifeStore();
    await store.load();
    await store.upsertFromItem('Mehl', '2027-01-09', today);

    const fresh = useShelfLifeStore();
    await fresh.load();
    expect(fresh.daysFor('Mehl')).toBe(245);
  });
});

describe('shelfLifeStore.daysFor', () => {
  it('liefert null für unbekannte Namen', async () => {
    const store = useShelfLifeStore();
    await store.load();
    expect(store.daysFor('Existiert nicht')).toBeNull();
    expect(store.daysFor('')).toBeNull();
    expect(store.daysFor(null)).toBeNull();
  });
});
