import etag from 'etag'
import config, { runtimeConfig } from './config'

export interface CacheEntry {
  content: Buffer
  etag: string
}

export class Cache {
  enabled: boolean

  cache = new Map<string, CacheEntry>()

  assetsCache = new Map<string, CacheEntry>()

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  listEntries(): IterableIterator<[string, CacheEntry]> {
    return this.cache.entries()
  }

  listAssetEntries(): IterableIterator<[string, CacheEntry]> {
    return this.assetsCache.entries()
  }

  get(url: string): CacheEntry | undefined {
    if (this.enabled && this.cache.has(url)) {
      return this.cache.get(url)
    }
    return undefined
  }

  set(url: string, content: string): CacheEntry {
    const entry = {
      content: Buffer.from(content),
      etag: etag(content),
    }
    if (this.enabled || runtimeConfig.cacheEverything) {
      this.cache.set(url, entry)
      if (config.log.cache) {
        console.info(`saved ${url} to cache.`)
      }
    }
    return entry
  }

  setAsset(url: string, buffer: Buffer): CacheEntry {
    const entry = {
      content: buffer,
      etag: etag(buffer),
    }
    if (this.enabled || runtimeConfig.cacheEverything) {
      this.assetsCache.set(url, entry)
      if (config.log.cache) {
        console.info(`saved ${url} to cache.`)
      }
    }
    return entry
  }

  clear(): void {
    this.cache = new Map()
    this.assetsCache = new Map()
    console.log('enableCache cleared.')
  }
}

const cache: Cache = new Cache(config.enableCache)

export default cache
