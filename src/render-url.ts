import { PageConfig } from './config'
import createPage from './create-page'
import renderPage from './render-page'
import cache from './cache'
import createBrowser from './create-browser'

const renderUrl = async (
  url: string,
  cacheResponses: boolean,
  pageConfig: PageConfig
): Promise<{ html: string; ttRenderMs: number }> => {
  const maybeCached = cache.get(url)
  if (maybeCached) {
    return maybeCached
  }
  const browser = await createBrowser()
  const start = Date.now()
  const page = await createPage(browser, pageConfig)
  console.log(`Navigating to:`, url)
  await page.goto(url, { waitUntil: 'networkidle0' })
  const html = await renderPage(page, pageConfig)
  await page.close()
  const ttRenderMs = Date.now() - start
  console.info(`Rendered page ${url} in: ${ttRenderMs}ms.`)

  cache.set(url, html)
  return { html, ttRenderMs }
}

export const clearCache = (): void => {
  cache.clear()
}

export default renderUrl
