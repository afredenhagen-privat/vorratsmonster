import { describe, it, expect } from 'vitest';
import { newItem, expiryLevel, LOCATIONS } from '../db/schema.js';

describe('newItem', () => {
  it('legt Defaults und Timestamps an', () => {
    const item = newItem({
      name: 'Milch',
      best_before: '2026-12-01',
      location: 'fridge'
    });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(item.barcode).toBeNull();
    expect(item.quantity).toBe(1);
    expect(item.is_opened).toBe(false);
    expect(item.deleted_at).toBeNull();
    expect(item.created_at).toBe(item.updated_at);
    expect(LOCATIONS).toContain(item.location);
  });

  it('verlangt name + best_before + gültige location', () => {
    expect(() =>
      newItem({ name: '', best_before: '2026-12-01', location: 'fridge' })
    ).toThrow();
    expect(() =>
      newItem({ name: 'X', best_before: '', location: 'fridge' })
    ).toThrow();
    expect(() =>
      newItem({ name: 'X', best_before: '2026-12-01', location: 'garage' })
    ).toThrow();
  });

  it('trimmt den Namen', () => {
    const item = newItem({
      name: '  Joghurt ',
      best_before: '2026-12-01',
      location: 'fridge'
    });
    expect(item.name).toBe('Joghurt');
  });
});

describe('expiryLevel', () => {
  const now = new Date('2026-05-08T12:00:00Z');

  it('rot bei abgelaufen', () => {
    expect(expiryLevel('2026-05-01', now)).toBe('red');
  });

  it('rot bei <= 2 Tagen', () => {
    expect(expiryLevel('2026-05-09', now)).toBe('red');
    expect(expiryLevel('2026-05-10', now)).toBe('red');
  });

  it('gelb bei 3-7 Tagen', () => {
    expect(expiryLevel('2026-05-12', now)).toBe('yellow');
    expect(expiryLevel('2026-05-15', now)).toBe('yellow');
  });

  it('grün bei > 7 Tagen', () => {
    expect(expiryLevel('2026-05-20', now)).toBe('green');
    expect(expiryLevel('2027-01-01', now)).toBe('green');
  });
});
