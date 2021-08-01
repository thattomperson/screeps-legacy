const heapCache = {};

/**
 * Caches arbitrary data in heap memory for some time.
 *
 * @param {string} cacheKey
 *   Name of the requested cache bin.
 * @param {number} maxAge
 *   Maximum age of cached data in ticks.
 * @param {function} generateCallback
 *   Callback to generate the cached data.
 *
 * @return {Object}
 *   The requested cache object.
 */
export function inHeap<T extends any>(cacheKey: string, maxAge: number, generateCallback: () => T): T {
  return inObject<T>(heapCache, cacheKey, maxAge, generateCallback);
}

/**
 * Caches arbitrary data in persistent memory for some time.
 *
 * @param {string} cacheKey
 *   Name of the requested cache bin.
 * @param {number} maxAge
 *   Maximum age of cached data in ticks.
 * @param {function} generateCallback
 *   Callback to generate the cached data.
 *
 * @return {Object}
 *   The requested cache object.
 */
export function inMemory<T>(cacheKey: string, maxAge: number, generateCallback: () => T): T {
  return inObject<T>(Memory, cacheKey, maxAge, generateCallback);
}

/**
 * Caches arbitrary data in an object's heap memory for some time.
 *
 * @param {object} o
 *   The object the data is attached to.
 * @param {string} cacheKey
 *   Name of the requested cache bin.
 * @param {number} maxAge
 *   Maximum age of cached data in ticks.
 * @param {function} generateCallback
 *   Callback to generate the cached data.
 *
 * @return {Object}
 *   The requested cache object.
 */
export function inObject<T extends any>(
  o: any,
  cacheKey: string,
  maxAge: number,
  generateCallback: (() => T) | ((o: any) => T)
): T {
  if (!o._cache) o._cache = {};

  if (!o._cache[cacheKey] || global.hivemind.hasIntervalPassed(maxAge, o._cache[cacheKey].created)) {
    const data = generateCallback ? generateCallback(o._cache[cacheKey]) : {};

    o._cache[cacheKey] = {
      data,
      maxAge,
      created: Game.time
    };
  }

  return o._cache[cacheKey].data;
}

/**
 * Clears cache entries that are stale.
 *
 * @param {object} o
 *   The object to collect garbage on. If not given, the general heap cache is
 *   garbage collected.
 */
export function collectGarbage(o?: any): void {
  if (!o) o = heapCache;

  for (const key in o._cache || {}) {
    if (Game.time - o._cache[key].created < 2 * o._cache[key].maxAge) continue;

    delete o._cache[key];
  }
}

/**
 * Deletes a cache entry forcibly.
 *
 * @param {object} o
 *   The object to remove cache data from. If not given, the general heap
 *   cache is used.
 * @param {string} key
 *   Cache key to remove data from.
 */
export function removeEntry(o: any, key: string): void {
  if (!o) o = heapCache;
  if (!o._cache) return;

  delete o._cache[key];
}

export default {
  inHeap,
  inMemory,
  inObject,
  collectGarbage,
  removeEntry
};
