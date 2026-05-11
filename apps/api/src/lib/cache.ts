export type CacheEntry<T> = {
  value: T
  createdAt: number
}

export function createCache<T>(ttlMs: number) {
  const cache = new Map<string, CacheEntry<T>>()

  return {
    get(key: string) {
      const entry = cache.get(key)
      if (!entry) {
        return null
      }

      if (Date.now() - entry.createdAt > ttlMs) {
        cache.delete(key)
        return null
      }

      return entry.value
    },
    set(key: string, value: T) {
      cache.set(key, { value, createdAt: Date.now() })
    },
    clear() {
      cache.clear()
    },
    delete(key: string) {
      cache.delete(key)
    },
  }
}

