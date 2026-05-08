import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { clearAllData } from '../db/database.js';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearAllData();
});

describe('inventoryStore.create + load', () => {
  it('legt Items an, persistiert sie und sortiert nach MHD', async () => {
    const store = useInventoryStore();
    await store.create({
      name: 'Joghurt',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.create({
      name: 'Milch',
      best_before: '2026-05-15',
      location: 'fridge'
    });
    expect(store.active.map((i) => i.name)).toEqual(['Milch', 'Joghurt']);

    const fresh = useInventoryStore();
    await fresh.load();
    expect(fresh.active.map((i) => i.name)).toEqual(['Milch', 'Joghurt']);
  });
});

describe('inventoryStore.filtered', () => {
  it('filtert nach Lagerort und Suchquery', async () => {
    const store = useInventoryStore();
    await store.create({
      name: 'Milch',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.create({
      name: 'Pommes',
      best_before: '2026-12-01',
      location: 'freezer'
    });
    await store.create({
      name: 'Mehl',
      best_before: '2027-01-01',
      location: 'pantry'
    });

    expect(store.filtered({ location: 'freezer' }).map((i) => i.name)).toEqual([
      'Pommes'
    ]);
    // Substring-Suche, case-insensitiv: 'm' matcht Milch, Pommes, Mehl
    expect(store.filtered({ query: 'M' }).map((i) => i.name)).toEqual([
      'Milch',
      'Pommes',
      'Mehl'
    ]);
    expect(store.filtered({ query: 'mil' }).map((i) => i.name)).toEqual([
      'Milch'
    ]);
    expect(
      store.filtered({ query: 'milch', location: 'fridge' }).map((i) => i.name)
    ).toEqual(['Milch']);
  });
});

describe('inventoryStore.softDelete + restore', () => {
  it('blendet aus aktiver Liste aus und kann via restore zurückgeholt werden', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Käse',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    expect(store.active).toHaveLength(1);

    await store.softDelete(item.id);
    expect(store.active).toHaveLength(0);
    expect(store.byId(item.id).deleted_at).not.toBeNull();

    await store.restore(item.id);
    expect(store.active).toHaveLength(1);
    expect(store.byId(item.id).deleted_at).toBeNull();
  });
});

describe('inventoryStore.update', () => {
  it('überschreibt erlaubte Felder und aktualisiert updated_at', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Milch',
      best_before: '2026-05-15',
      location: 'fridge'
    });
    const before = item.updated_at;
    await new Promise((r) => setTimeout(r, 5));

    await store.update(item.id, {
      best_before: '2026-05-20',
      quantity: 2
    });
    const updated = store.byId(item.id);
    expect(updated.best_before).toBe('2026-05-20');
    expect(updated.quantity).toBe(2);
    expect(updated.updated_at).not.toBe(before);
  });

  it('lehnt leere Namen und ungültige Locations ab', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Milch',
      best_before: '2026-05-15',
      location: 'fridge'
    });
    await expect(store.update(item.id, { name: '   ' })).rejects.toThrow();
    await expect(
      store.update(item.id, { location: 'garage' })
    ).rejects.toThrow();
  });
});

describe('inventoryStore.distinctManualNames', () => {
  it('liefert unique Namen aus manuellen Einträgen, neueste zuerst, ohne Barcode-Items', async () => {
    const store = useInventoryStore();
    await store.create({
      name: 'Kartoffeln',
      best_before: '2026-06-01',
      location: 'pantry'
    });
    await new Promise((r) => setTimeout(r, 5));
    await store.create({
      name: 'Zwiebeln',
      best_before: '2026-06-01',
      location: 'pantry'
    });
    await new Promise((r) => setTimeout(r, 5));
    await store.create({
      name: 'Kartoffeln',
      best_before: '2026-07-01',
      location: 'pantry'
    });
    await store.create({
      barcode: '1234567890123',
      name: 'Milch',
      best_before: '2026-06-01',
      location: 'fridge'
    });

    const names = store.distinctManualNames;
    expect(names).toEqual(['Kartoffeln', 'Zwiebeln']);
  });
});
