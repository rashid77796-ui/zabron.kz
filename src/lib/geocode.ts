import { Bathhouse } from './types';

const CACHE_KEY = 'banya_geocode_cache';

interface GeoCache {
  [address: string]: { lat: number; lng: number } | null;
}

const getCache = (): GeoCache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveCache = (cache: GeoCache) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const q = encodeURIComponent(address + ', Астана, Казахстан');
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'BanyaApp/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Geocodes bathhouses that don't have coordinates.
 * Processes in batches with rate limiting and caches results.
 * Calls onUpdate with updated bathhouses after each batch.
 */
export const geocodeBathhouses = async (
  bathhouses: Bathhouse[],
  onUpdate: (updated: Bathhouse[]) => void,
  batchSize = 5
) => {
  const cache = getCache();
  const needsGeocoding: number[] = [];
  const result = [...bathhouses];

  // Apply cached coordinates first
  for (let i = 0; i < result.length; i++) {
    const b = result[i];
    if (b.lat && b.lng) continue;
    
    const cached = cache[b.address];
    if (cached) {
      result[i] = { ...b, lat: cached.lat, lng: cached.lng };
    } else if (cached === null) {
      // Previously failed, skip
    } else {
      needsGeocoding.push(i);
    }
  }

  // If cache applied any, update immediately
  if (result.some((b, i) => b.lat !== bathhouses[i].lat)) {
    onUpdate(result);
  }

  if (needsGeocoding.length === 0) return result;

  // Process in batches
  for (let batch = 0; batch < needsGeocoding.length; batch += batchSize) {
    const indices = needsGeocoding.slice(batch, batch + batchSize);
    
    for (const idx of indices) {
      const b = result[idx];
      const coords = await geocodeAddress(b.address);
      cache[b.address] = coords;
      if (coords) {
        result[idx] = { ...b, lat: coords.lat, lng: coords.lng };
      }
      // Rate limit: 1 req/sec for Nominatim
      await new Promise(r => setTimeout(r, 1100));
    }

    saveCache(cache);
    onUpdate([...result]);
  }

  return result;
};