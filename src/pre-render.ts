import { gray, yellow } from 'chalk'
import createPage from './create-page'
import renderPage from './render-page'
import cache from './cache'
import config, { envConfig } from './config'
import createBrowser from './create-browser'
import { renderTimeMetric } from './metrics'

const { preRender: preRenderEnabled, preRenderPaths, page: pageConfig } = config

const preRender = async (): Promise<void> => {
  if (!preRenderEnabled) {
    console.error(`pre-render is not enabled`)
  }
  const target = `http://${envConfig.hostname}:${config.httpPort}`

  const browser = await createBrowser()
  const page = await createPage(browser)

  const start = Date.now()
  const timerHandle = renderTimeMetric.startTimer({ url: `${target}/` })
  if (config.log.navigation) {
    console.log(`[pre-render] navigating to: ${yellow(`${target}/`)}`)
  }
  await page.goto(`${target}/`, { waitUntil: 'networkidle0' })
  const html = await renderPage(page)
  timerHandle()
  const ttRenderMs = Date.now() - start
  if (config.log.renderTime) {
    console.info(`[pre-render] rendered ${target}/: ${yellow(`${ttRenderMs}ms`)}`)
  }
  cache.set(`${target}/`, html)

  const processPath = async (path: string) => {
    const url = `${target}${path}`
    const pathStart = Date.now()
    const pathTimerHandle = renderTimeMetric.startTimer({ url: `${target}/` })
    if (pageConfig.preNavigationScript) {
      if (config.log.navigation) {
        console.log(`[pre-render] running pre-navigation script`)
      }
      await page.evaluate((preNavigationScript) => {
        // eslint-disable-next-line no-eval
        eval(preNavigationScript)
      }, pageConfig.preNavigationScript)
    }
    if (config.log.navigation) {
      console.log(`[pre-render] navigating to: ${yellow(url)} (${pageConfig.navigateFunction})`)
    }
    await page.evaluate(
      (navigateFunction, navigateToURL) => {
        // eslint-disable-next-line no-eval
        eval(`(${navigateFunction})('${navigateToURL}')`)
      },
      pageConfig.navigateFunction,
      url
    )

    const pathHtml = await renderPage(page)
    pathTimerHandle()
    const pathRenderMs = Date.now() - pathStart
    if (config.log.renderTime) {
      console.info(`[pre-render] rendered ${url}: ${yellow(`${pathRenderMs}ms`)}`)
    }
    cache.set(url, pathHtml)
  }

  const processPaths = async (paths: string[]) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const path of paths) {
      // eslint-disable-next-line no-await-in-loop
      await processPath(path)
    }
  }

  await processPaths(preRenderPaths)
}

export default preRender
