import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProductsStore } from '../stores/productsStore.js';
import { clearAllData, db } from '../db/database.js';
import * as offService from '../services/openFoodFacts.js';

beforeEach(async () => {
  setActivePinia(createPinia());
  await clearAllData();
  vi.restoreAllMocks();
});

describe('productsStore.lookup', () => {
  it('liefert lokalen Eintrag und ruft OFF gar nicht', async () => {
    const store = useProductsStore();
    await store.upsert({
      barcode: '4001234567890',
      name: 'Vollmilch',
      source: 'user'
    });
    const offSpy = vi.spyOn(offService, 'fetchProduct');
    const result = await store.lookup('4001234567890');
    expect(result.name).toBe('Vollmilch');
    expect(result._from).toBe('local');
    expect(offSpy).not.toHaveBeenCalled();
  });

  it('fällt auf OFF zurück, wenn lokal nichts da ist', async () => {
    const store = useProductsStore();
    vi.spyOn(offService, 'fetchProduct').mockResolvedValue({
      barcode: '4001234567890',
      name: 'OFF-Produkt',
      brand: 'Marke',
      image_url: null,
      category: null
    });
    const result = await store.lookup('4001234567890');
    expect(result.name).toBe('OFF-Produkt');
    expect(result._from).toBe('off');
  });

  it('liefert null, wenn lokal und OFF leer', async () => {
    const store = useProductsStore();
    vi.spyOn(offService, 'fetchProduct').mockResolvedValue(null);
    const result = await store.lookup('9999999999999');
    expect(result).toBeNull();
  });

  it('ignoriert lokal soft-gelöschte Einträge und fällt auf OFF zurück', async () => {
    const store = useProductsStore();
    await db.my_products.put({
      barcode: '111',
      name: 'Alt',
      brand: null,
      image_url: null,
      category: null,
      source: 'user',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
      deleted_at: '2026-05-08T00:00:00Z'
    });
    const offSpy = vi
      .spyOn(offService, 'fetchProduct')
      .mockResolvedValue(null);
    const result = await store.lookup('111');
    expect(result).toBeNull();
    expect(offSpy).toHaveBeenCalled();
  });
});

describe('productsStore.upsert', () => {
  it('legt neuen Eintrag an mit Timestamps', async () => {
    const store = useProductsStore();
    const before = Date.now();
    const rec = await store.upsert({
      barcode: '111',
      name: 'Joghurt',
      brand: 'Müller',
      source: 'user'
    });
    expect(rec.barcode).toBe('111');
    expect(rec.name).toBe('Joghurt');
    expect(rec.brand).toBe('Müller');
    expect(rec.source).toBe('user');
    expect(rec.deleted_at).toBeNull();
    expect(new Date(rec.created_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(rec.updated_at).toBe(rec.created_at);
  });

  it('Update überschreibt Felder und aktualisiert updated_at', async () => {
    const store = useProductsStore();
    const first = await store.upsert({
      barcode: '111',
      name: 'OFF-Generic',
      source: 'off'
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.upsert({
      barcode: '111',
      name: 'Vollmilch Bauernhof',
      brand: 'Direkt',
      source: 'off' // explizit gleich
    });
    expect(second.name).toBe('Vollmilch Bauernhof');
    expect(second.brand).toBe('Direkt');
    expect(second.created_at).toBe(first.created_at);
    expect(second.updated_at).not.toBe(first.updated_at);
  });

  it('hebt Soft-Delete bei erneuter upsert auf', async () => {
    const store = useProductsStore();
    await db.my_products.put({
      barcode: '111',
      name: 'X',
      brand: null,
      image_url: null,
      category: null,
      source: 'user',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
      deleted_at: '2026-05-08T00:00:00Z'
    });
    const rec = await store.upsert({
      barcode: '111',
      name: 'Reaktiviert',
      source: 'user'
    });
    expect(rec.deleted_at).toBeNull();
  });

  it('verwendet existierende source, wenn upsert ohne source aufgerufen wird', async () => {
    const store = useProductsStore();
    await store.upsert({ barcode: '111', name: 'X', source: 'off' });
    const updated = await store.upsert({ barcode: '111', name: 'Y' });
    expect(updated.source).toBe('off');
  });

  it('lehnt upsert ohne barcode oder name ab', async () => {
    const store = useProductsStore();
    await expect(store.upsert({ name: 'X' })).rejects.toThrow();
    await expect(store.upsert({ barcode: '111', name: '   ' })).rejects.toThrow();
  });
});
