import config from './config'

export interface CacheEntry {
  html: string
  ttRenderMs: number
}

export class Cache {
  enabled: boolean

  cache = new Map<string, string>()

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  get(url: string): CacheEntry | undefined {
    if (this.enabled && this.cache.has(url)) {
      return { html: this.cache.get(url), ttRenderMs: 0 }
    }
    return undefined
  }

  set(url: string, html: string): void {
    if (this.enabled) {
      this.cache.set(url, html)
      console.info(`Saved to cache.`)
    }
  }

  clear(): void {
    this.cache = new Map()
    console.log('Cache cleared.')
  }
}

const cache: Cache = new Cache(config.cacheResponses)

export default cache
