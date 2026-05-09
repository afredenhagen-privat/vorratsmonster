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

describe('inventoryStore.toggleOpened / setOpened', () => {
  it('toggleOpened bei quantity=1: flippt is_opened und setzt opened_at', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Joghurt',
      quantity: 1,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    expect(item.is_opened).toBe(false);

    const r1 = await store.toggleOpened(item.id);
    expect(r1.kind).toBe('toggled');
    expect(store.byId(item.id).is_opened).toBe(true);
    expect(store.byId(item.id).opened_at).toBeTruthy();

    const r2 = await store.toggleOpened(item.id);
    expect(r2.kind).toBe('toggled');
    expect(store.byId(item.id).is_opened).toBe(false);
    expect(store.byId(item.id).opened_at).toBeNull();
  });

  it('toggleOpened bei quantity>1: SPLIT (Original -1, neues angebrochenes Item)', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Joghurt',
      quantity: 3,
      best_before: '2026-06-01',
      location: 'fridge'
    });

    const result = await store.toggleOpened(item.id);
    expect(result.kind).toBe('split');
    expect(result.original.quantity).toBe(2);
    expect(result.original.is_opened).toBe(false);
    expect(result.splitItem.quantity).toBe(1);
    expect(result.splitItem.is_opened).toBe(true);
    expect(result.splitItem.opened_at).toBeTruthy();
    expect(result.splitItem.id).not.toBe(item.id);
    // Beide Items sind aktiv
    expect(store.active.length).toBe(2);
    // Charge-Daten kopiert
    expect(result.splitItem.name).toBe('Joghurt');
    expect(result.splitItem.best_before).toBe('2026-06-01');
    expect(result.splitItem.location).toBe('fridge');
  });

  it('undoSplit: löscht Split-Item, addiert Menge zurück', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Joghurt',
      quantity: 3,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    const { original, splitItem } = await store.toggleOpened(item.id);
    await store.undoSplit(original.id, splitItem.id);
    expect(store.active.length).toBe(1);
    expect(store.byId(item.id).quantity).toBe(3);
    expect(store.byId(splitItem.id)).toBeUndefined();
  });

  it('setOpened mit konkretem Wert (für Undo)', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Käse',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.setOpened(item.id, true, '2026-05-01T10:00:00Z');
    expect(store.byId(item.id).is_opened).toBe(true);
    expect(store.byId(item.id).opened_at).toBe('2026-05-01T10:00:00Z');
  });
});

describe('inventoryStore.setQuantity', () => {
  it('positives delta erhöht', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Joghurt',
      quantity: 3,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    const result = await store.setQuantity(item.id, 1);
    expect(result.kind).toBe('updated');
    expect(store.byId(item.id).quantity).toBe(4);
  });

  it('negatives delta dekrementiert', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Joghurt',
      quantity: 3,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    const result = await store.setQuantity(item.id, -1);
    expect(result.kind).toBe('updated');
    expect(store.byId(item.id).quantity).toBe(2);
  });

  it('delta auf 0 → Soft-Delete', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Letzter Joghurt',
      quantity: 1,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    const result = await store.setQuantity(item.id, -1);
    expect(result.kind).toBe('deleted');
    expect(store.byId(item.id).deleted_at).not.toBeNull();
    expect(store.active).toHaveLength(0);
  });

  it('delta unter 0 wird auf 0 geclampt → Soft-Delete', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'X',
      quantity: 2,
      best_before: '2026-06-01',
      location: 'fridge'
    });
    const result = await store.setQuantity(item.id, -10);
    expect(result.kind).toBe('deleted');
  });
});

describe('inventoryStore.freeze', () => {
  it('setzt location auf freezer und schiebt MHD um 6 Monate', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Brot',
      best_before: '2026-05-15',
      location: 'pantry'
    });
    const result = await store.freeze(item.id);
    expect(result.item.location).toBe('freezer');
    expect(result.item.best_before).toBe('2026-11-15');
    expect(result.snapshot).toEqual({
      location: 'pantry',
      best_before: '2026-05-15'
    });
  });

  it('restoreSnapshot rollt zurück (für Undo)', async () => {
    const store = useInventoryStore();
    const item = await store.create({
      name: 'Brot',
      best_before: '2026-05-15',
      location: 'pantry'
    });
    const { snapshot } = await store.freeze(item.id);
    await store.restoreSnapshot(item.id, snapshot);
    expect(store.byId(item.id).location).toBe('pantry');
    expect(store.byId(item.id).best_before).toBe('2026-05-15');
  });
});

describe('inventoryStore.filtered – erweitert', () => {
  it('filtert nach is_opened', async () => {
    const store = useInventoryStore();
    const a = await store.create({
      name: 'Joghurt',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.create({
      name: 'Milch',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.toggleOpened(a.id);
    expect(store.filtered({ opened: true }).map((i) => i.name)).toEqual(['Joghurt']);
  });

  it('filtert nach barcode', async () => {
    const store = useInventoryStore();
    await store.create({
      barcode: '111',
      name: 'A',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.create({
      barcode: '222',
      name: 'B',
      best_before: '2026-06-02',
      location: 'fridge'
    });
    expect(store.filtered({ barcode: '111' }).map((i) => i.name)).toEqual(['A']);
  });

  it('kombiniert mehrere Filter', async () => {
    const store = useInventoryStore();
    const a = await store.create({
      name: 'Joghurt Mango',
      best_before: '2026-06-01',
      location: 'fridge'
    });
    await store.create({
      name: 'Joghurt Vanille',
      best_before: '2026-06-02',
      location: 'fridge'
    });
    await store.toggleOpened(a.id);
    const result = store.filtered({
      query: 'mango',
      location: 'fridge',
      opened: true
    });
    expect(result.map((i) => i.name)).toEqual(['Joghurt Mango']);
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
