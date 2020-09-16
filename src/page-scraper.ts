import { red } from 'chalk'
import { Page } from 'puppeteer-core'

export interface PathToVisit {
  path: string
  initial: boolean
  depth: number
}

export class PageScraper {
  private _seenPaths: string[] = []

  private _visitedPaths: string[] = []

  private _pathsToVisit: PathToVisit[] = []

  private readonly _scrapeDepth: number

  private readonly _origins: string[]

  constructor(scrapeDepth: number, origins: string[]) {
    this._scrapeDepth = scrapeDepth
    this._origins = origins
  }

  seen(path: string[]): void {
    this._seenPaths.push(...path)
  }

  pathsToVisit(p: PathToVisit[]): void {
    this._pathsToVisit.push(...p)
  }

  pathsVisited(): number {
    return this._visitedPaths.length
  }

  shift(): PathToVisit | undefined {
    let next = this._pathsToVisit.shift()
    while (next) {
      if (this._visitedPaths.indexOf(next.path) === -1) {
        this._visitedPaths.push(next.path)
        break
      }
      next = this._pathsToVisit.shift()
    }
    return next
  }

  remaining(): number {
    return this._pathsToVisit.length
  }

  async scrape(page: Page, depth: number): Promise<void> {
    if (depth <= this._scrapeDepth) {
      console.log(`[page-scraper] scraping page, depth ${depth}`)

      // eslint-disable-next-line no-undef
      const urlStrings = await page.$$eval('a', (links) => links.map((link: HTMLAnchorElement) => link.href))
      const urls = urlStrings
        .filter((a) => a !== '')
        .filter((a) => a !== '#')
        // eslint-disable-next-line no-script-url
        .filter((a) => a !== 'javascript:void(0)')
        .map((s) => {
          try {
            return new URL(s)
          } catch (e) {
            console.error(red(`[page-scraper] invalid URL: '${s}'`))
            return null
          }
        })
        .filter((u) => u !== null)
        .filter((a) => this._origins.some((origin) => origin === a.origin))

      console.log('[page-scraper] found links: ', urls.length)
      urls.forEach((a) => {
        if (this._seenPaths.indexOf(a.pathname) === -1 && !this._pathsToVisit.some((p) => p.path === a.pathname)) {
          console.log(`[page-scraper] found link: ${a.pathname}`)
          this._seenPaths.push(a.pathname)
          this._pathsToVisit.push({
            path: a.pathname,
            initial: false,
            depth: depth + 1,
          })
        }
      })
    } else {
      console.log(`[page-scraper] not scraping: ${depth} > ${this._scrapeDepth}`)
    }
  }
}
