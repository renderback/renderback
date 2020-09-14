import { yellow } from 'chalk'
import config from './config'
import createPage from './create-page'
import renderPage from './render-page'
import cache, { CacheEntry } from './cache'
import createBrowser from './create-browser'
import { renderTimeMetric } from './metrics'

const renderUrl = async (url: string): Promise<CacheEntry & { ttRenderMs?: number }> => {
  const maybeCached = cache.get(url)
  if (maybeCached) {
    return { ...maybeCached }
  }
  const browser = await createBrowser()
  const start = Date.now()
  const timerHandle = renderTimeMetric.startTimer({ url })
  const page = await createPage(browser)
  if (config.log.navigation) {
    console.log(yellow(`[render-url] navigating to: ${url}`))
  }
  await page.goto(url, { waitUntil: 'networkidle0' })
  const [status, html] = await renderPage(page)
  await page.close()
  const ttRenderMs = Date.now() - start
  timerHandle()
  if (config.log.renderTime) {
    console.info(yellow(`[render-url] ${url}: ${ttRenderMs}ms.`))
  }

  const entry = cache.set(url, html, status)
  return { ttRenderMs, ...entry }
}

export default renderUrl
