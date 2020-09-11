import etag from 'etag'
import config from './config'

export interface CacheEntry {
  html: string
  etag: string
}

export class Cache {
  enabled: boolean

  cache = new Map<string, CacheEntry>()

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  get(url: string): CacheEntry | undefined {
    if (this.enabled && this.cache.has(url)) {
      return this.cache.get(url)
    }
    return undefined
  }

  set(url: string, html: string): CacheEntry {
    const entry = {
      html,
      etag: etag(html),
    }
    if (this.enabled) {
      this.cache.set(url, entry)
      console.info(`Saved to cache.`)
    }
    return entry
  }

  clear(): void {
    this.cache = new Map()
    console.log('Cache cleared.')
  }
}

const cache: Cache = new Cache(config.cacheResponses)

export default cache
