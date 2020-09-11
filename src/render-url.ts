import config, { PageConfig } from './config'
import createPage from './create-page'
import renderPage from './render-page'
import cache, { CacheEntry } from './cache'
import createBrowser from './create-browser'

const renderUrl = async (
  url: string,
  cacheResponses: boolean,
  pageConfig: PageConfig
): Promise<CacheEntry & { ttRenderMs?: number }> => {
  const maybeCached = cache.get(url)
  if (maybeCached) {
    return maybeCached
  }
  const browser = await createBrowser()
  const start = Date.now()
  const page = await createPage(browser, pageConfig)
  if (config.log.headless) {
    console.log(`ssr: navigating to:`, url)
  }
  await page.goto(url, { waitUntil: 'networkidle0' })
  const html = await renderPage(page, pageConfig)
  await page.close()
  const ttRenderMs = Date.now() - start
  if (config.log.headless) {
    console.info(`rendered ${url}: ${ttRenderMs}ms.`)
  }

  const entry = cache.set(url, html)
  return { ttRenderMs, ...entry }
}

export default renderUrl
