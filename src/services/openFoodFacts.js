/**
 * Open Food Facts Lookup.
 * API-Doku: https://world.openfoodfacts.org/data
 *
 * Liefert ein normalisiertes Produkt-Objekt oder null, wenn der Barcode
 * nicht gefunden wird oder das Netz weg ist (Caller zeigt dann ein
 * leeres Formular mit vorausgefülltem Barcode).
 */
const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

export async function fetchProduct(barcode) {
  if (!barcode) return null;
  const url = `${ENDPOINT}/${encodeURIComponent(barcode)}.json`;
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  if (payload.status !== 1 || !payload.product) {
    return null;
  }
  const p = payload.product;
  return {
    barcode,
    name:
      p.product_name_de ||
      p.product_name ||
      p.generic_name_de ||
      p.generic_name ||
      null,
    brand: pickFirst(p.brands),
    image_url: p.image_front_url || p.image_url || null,
    category: pickFirst(p.categories)
  };
}

function pickFirst(commaList) {
  if (!commaList) return null;
  const first = String(commaList).split(',')[0].trim();
  return first || null;
}
