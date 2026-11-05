const CACHE_TTL = 3600000;
const CACHE_VERSION = 2;

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function getCacheKey(method, input) {
  return 'io_cache_v' + CACHE_VERSION + '_' + hashString(JSON.stringify({ method, input }));
}

function getFromCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  const entry = {
    result: data,
    cachedAt: Date.now(),
    ttl: CACHE_TTL,
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

function clearCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('io_cache_')) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
