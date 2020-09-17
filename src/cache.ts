import etag from 'etag'
import { Request } from 'puppeteer-core'
import config, { runtimeConfig } from './config'

export interface CacheEntry {
  content: Buffer
  etag: string
  status: number
  location?: URL
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

  set(url: string, content: string, status: number, location?: URL): CacheEntry {
    const entry = {
      content: Buffer.from(content),
      etag: etag(content),
      status,
      location,
    }
    if (this.enabled || runtimeConfig.cacheEverything) {
      this.cache.set(url, entry)
      if (config.log.cache) {
        console.log(
          `[cache] cached page ${url} status: ${entry.status}${entry.location ? ` location: ${entry.location}` : ''}`
        )
      }
    } else {
      console.log(
        `[cache] NOT caching page ${url} status: ${entry.status}${entry.location ? ` location: ${entry.location}` : ''}`
      )
    }
    return entry
  }

  setAsset(url: string, buffer: Buffer, status: number, location?: URL): CacheEntry {
    const entry = {
      content: buffer,
      etag: etag(buffer),
      status,
      location,
    }
    if (this.enabled || runtimeConfig.cacheEverything) {
      this.assetsCache.set(url, entry)
      if (config.log.cache) {
        console.log(
          `[cache] cached asset ${url} status: ${entry.status}${entry.location ? ` location: ${entry.location}` : ''}`
        )
      }
    } else {
      console.log(
        `[cache] NOT caching asset ${url} status: ${entry.status}${
          entry.location ? ` location: ${entry.location}` : ''
        }`
      )
    }
    return entry
  }

  clear(): void {
    this.cache = new Map()
    this.assetsCache = new Map()
    console.log('[cache] cache cleared')
  }
}

const cache: Cache = new Cache(config.enableCache)

export const cachePageRenderResult = ({
  url,
  html,
  status,
  redirects,
}: {
  url: string
  html: string
  status: number
  location?: string
  redirects?: Request[]
}): [string, CacheEntry] => {
  let endUrl = url
  if (redirects?.length > 0) {
    redirects.forEach((r) => {
      console.log(`[cache] caching redirect ${r.url()} -> ${r.frame().url()}`)
      cache.set(r.url(), '', 302, new URL(r.frame().url()))
      endUrl = r.frame().url()
    })
  }
  return [endUrl, cache.set(endUrl, html, status)]
}

export default cache
