import createPage from './create-page'
import renderPage from './render-page'
import cache from './cache'
import config, { envConfig } from './config'
import createBrowser from './create-browser'
import { renderTimeMetric } from './metrics'

const { preRender: preRenderConfig, page: pageConfig } = config

const preRender = async (): Promise<void> => {
  if (!preRenderConfig) {
    console.error(`pre-render is not configured`)
  }
  const target = `http://${envConfig.hostname}:${config.port}`

  const browser = await createBrowser()
  const page = await createPage(browser)

  const start = Date.now()
  const timerHandle = renderTimeMetric.startTimer({ url: `${target}/` })
  if (config.log.headless) {
    console.log(`pre-render: navigating to:`, `${target}/`)
  }
  await page.goto(`${target}/`, { waitUntil: 'networkidle0' })
  const html = await renderPage(page)
  timerHandle()
  const ttRenderMs = Date.now() - start
  if (config.log.renderTime) {
    console.info(`rendered ${target}/: ${ttRenderMs}ms.`)
  }
  cache.set(`${target}/`, html)

  const processPath = async (path: string) => {
    const url = `${target}${path}`
    const pathStart = Date.now()
    const pathTimerHandle = renderTimeMetric.startTimer({ url: `${target}/` })
    if (config.log.headless) {
      console.log(`pre-render: navigating to: ${url}`)
    }
    await page.evaluate(
      (resetSelectorScript, navigateScript) => {
        // eslint-disable-next-line no-eval
        eval(resetSelectorScript)
        // eslint-disable-next-line no-eval
        eval(navigateScript)
      },
      pageConfig.resetScript,
      // eslint-disable-next-line no-template-curly-in-string
      pageConfig.navigateScript.replace('${url}', `${url}`)
    )

    const pathHtml = await renderPage(page)
    pathTimerHandle()
    const pathRenderMs = Date.now() - pathStart
    if (config.log.renderTime) {
      console.info(`rendered ${url}: ${pathRenderMs}ms.`)
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

  await processPaths(preRenderConfig.paths)
}

export default preRender
