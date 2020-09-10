import createPage from './create-page'
import renderPage from './render-page'
import cache from './cache'
import config, { PageConfig, PreRenderConfig } from './config'
import createBrowser from './create-browser'

const preRender = async (
  preRenderConfig: PreRenderConfig,
  pageConfig: PageConfig,
  startUrl?: string
): Promise<void> => {
  const target = startUrl || `http://express-http.local:${config.port}`

  const browser = await createBrowser()
  const page = await createPage(browser, pageConfig)

  console.log(`Pre-render: navigating to: ${target}/`)
  const start = Date.now()
  await page.goto(`${target}/`, { waitUntil: 'networkidle0' })
  const html = await renderPage(page, pageConfig)
  const ttRenderMs = Date.now() - start
  console.info(`Rendered page ${target}/ in: ${ttRenderMs}ms.`)
  cache.set(`${target}/`, html)

  const processPath = async (path: string) => {
    const url = `${target}${path}`
    const pathStart = Date.now()
    console.log(`Pre-render: navigating to: ${url}`)
    await page.evaluate(
      (resetSelectorScript, navigateScript) => {
        // eslint-disable-next-line no-eval
        eval(resetSelectorScript)
        // eslint-disable-next-line no-eval
        eval(navigateScript)
      },
      pageConfig.resetSelectorScript,
      // eslint-disable-next-line no-template-curly-in-string
      pageConfig.navigateScript.replace('${url}', `${url}`)
    )

    const pathHtml = await renderPage(page, pageConfig)
    const pathRenderMs = Date.now() - pathStart
    console.info(`Rendered page ${url} in: ${pathRenderMs}ms.`)
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
