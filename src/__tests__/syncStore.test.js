import { describe, it, expect, beforeEach } from 'vitest';
import { mergeIntoDexie } from '../stores/syncStore.js';
import { db, clearAllData } from '../db/database.js';

beforeEach(async () => {
  await clearAllData();
});

describe('mergeIntoDexie – Last-Write-Wins', () => {
  it('items: lokal fehlt → Cloud-Eintrag wird eingefügt', async () => {
    const cloudRow = {
      id: 'abc',
      user_id: 'user-1',
      barcode: null,
      name: 'Käse',
      brand: null,
      image_url: null,
      category: null,
      quantity: 1,
      best_before: '2026-06-01',
      location: 'fridge',
      is_opened: false,
      opened_at: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T10:00:00Z',
      deleted_at: null
    };
    const wrote = await mergeIntoDexie('items', cloudRow);
    expect(wrote).toBe(true);
    const local = await db.items.get('abc');
    expect(local.name).toBe('Käse');
    // user_id wird beim Lokal-Schreiben entfernt
    expect(local.user_id).toBeUndefined();
  });

  it('items: lokal neuer → Cloud-Eintrag wird verworfen', async () => {
    const local = {
      id: 'abc',
      barcode: null,
      name: 'Käse (lokal)',
      brand: null,
      image_url: null,
      category: null,
      quantity: 1,
      best_before: '2026-06-01',
      location: 'fridge',
      is_opened: false,
      opened_at: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T12:00:00Z',
      deleted_at: null
    };
    await db.items.put(local);
    const cloudRow = { ...local, name: 'Käse (cloud)', updated_at: '2026-05-09T10:00:00Z' };
    const wrote = await mergeIntoDexie('items', cloudRow);
    expect(wrote).toBe(false);
    const after = await db.items.get('abc');
    expect(after.name).toBe('Käse (lokal)');
  });

  it('items: Cloud neuer → lokal wird überschrieben', async () => {
    const local = {
      id: 'abc',
      name: 'Alt',
      best_before: '2026-06-01',
      location: 'fridge',
      quantity: 1,
      is_opened: false,
      opened_at: null,
      barcode: null,
      brand: null,
      image_url: null,
      category: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T10:00:00Z',
      deleted_at: null
    };
    await db.items.put(local);
    const cloudRow = { ...local, name: 'Neu', updated_at: '2026-05-09T12:00:00Z' };
    const wrote = await mergeIntoDexie('items', cloudRow);
    expect(wrote).toBe(true);
    const after = await db.items.get('abc');
    expect(after.name).toBe('Neu');
  });

  it('my_products: keyed by barcode, LWW funktioniert genauso', async () => {
    await db.my_products.put({
      barcode: '111',
      name: 'Alt',
      brand: null,
      image_url: null,
      category: null,
      source: 'user',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T10:00:00Z',
      deleted_at: null
    });
    const cloudRow = {
      barcode: '111',
      user_id: 'u',
      name: 'Neu',
      brand: null,
      image_url: null,
      category: null,
      source: 'user',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T12:00:00Z',
      deleted_at: null
    };
    await mergeIntoDexie('my_products', cloudRow);
    const after = await db.my_products.get('111');
    expect(after.name).toBe('Neu');
  });

  it('shelf_life_presets: keyed by name_lower', async () => {
    const cloudRow = {
      name_lower: 'kartoffeln',
      user_id: 'u',
      days: 14,
      updated_at: '2026-05-09T12:00:00Z'
    };
    await mergeIntoDexie('shelf_life_presets', cloudRow);
    const after = await db.shelf_life_presets.get('kartoffeln');
    expect(after.days).toBe(14);
    expect(after.user_id).toBeUndefined();
  });

  it('Soft-Delete via Cloud: deleted_at wird übernommen', async () => {
    const local = {
      id: 'abc',
      name: 'X',
      best_before: '2026-06-01',
      location: 'fridge',
      quantity: 1,
      is_opened: false,
      opened_at: null,
      barcode: null,
      brand: null,
      image_url: null,
      category: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-09T10:00:00Z',
      deleted_at: null
    };
    await db.items.put(local);
    const cloudRow = {
      ...local,
      updated_at: '2026-05-09T12:00:00Z',
      deleted_at: '2026-05-09T12:00:00Z'
    };
    await mergeIntoDexie('items', cloudRow);
    const after = await db.items.get('abc');
    expect(after.deleted_at).toBe('2026-05-09T12:00:00Z');
  });
});
