import { red, yellow } from 'chalk'
import createPage from './create-page'
import renderPage from './render-page'
import cache from './cache'
import config, { envConfig } from './config'
import createBrowser from './create-browser'
import { renderTimeMetric } from './metrics'

const { preRender: preRenderEnabled, preRenderPaths, page: pageConfig, preRenderScrape, preRenderScrapeDepth } = config

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
  const [status, html] = await renderPage(page)
  timerHandle()
  const ttRenderMs = Date.now() - start
  if (config.log.renderTime) {
    console.info(`[pre-render] rendered ${target}/: ${yellow(`${ttRenderMs}ms`)}`)
  }
  cache.set(`${target}/`, html, status)

  const pathsToVisit: { path: string; depth: number }[] = preRenderPaths.map((path) => ({
    path,
    depth: 1,
  }))
  const seenPaths: string[] = ['/', ...preRenderPaths]
  const visitedPaths: string[] = ['/']

  const scrapePaths = async (depth: number) => {
    if (preRenderScrape && depth <= preRenderScrapeDepth) {
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
            console.error(red(`[pre-render] invalid URL: '${s}'`))
            return null
          }
        })
        .filter((u) => u !== null)

      console.log('[pre-render] found links: ', urls.length)
      urls
        .filter((a) => a.hostname === envConfig.hostname && a.protocol === 'http:')
        .filter((a) => seenPaths.indexOf(a.pathname) === -1)
        .forEach((a) => {
          console.log(`[pre-render] found link: ${a.pathname}`)
          seenPaths.push(a.pathname)
          pathsToVisit.push({
            path: a.pathname,
            depth: depth + 1,
          })
        })
    }
  }

  await scrapePaths(1)

  const processPath = async (path: string, depth: number) => {
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

    const [pathStatus, pathHtml] = await renderPage(page)
    pathTimerHandle()
    const pathRenderMs = Date.now() - pathStart
    if (config.log.renderTime) {
      console.info(`[pre-render] rendered ${url}: ${yellow(`${pathRenderMs}ms`)}`)
    }
    cache.set(url, pathHtml, pathStatus)
    await scrapePaths(depth)
  }

  const processPaths = async () => {
    try {
      while (pathsToVisit.length > 0) {
        console.log(
          `[pre-render] path to visit remaining: ${pathsToVisit.length}, considering path: ${JSON.stringify(
            pathsToVisit[0]
          )}`
        )
        const { path, depth } = pathsToVisit[0]
        pathsToVisit.shift()
        if (visitedPaths.indexOf(path) === -1 && (!preRenderScrapeDepth || depth <= preRenderScrapeDepth)) {
          console.log(`[pre-render] pushing path to visited: ${path} ${depth}`)
          visitedPaths.push(path)
          console.log(`[pre-render] processing path: ${path} ${depth}`)
          // eslint-disable-next-line no-await-in-loop
          await processPath(path, depth)
        } else if (visitedPaths.indexOf(path) !== -1) {
          console.log(`[pre-render] path already visited: ${path}`)
        } else {
          console.log(`[pre-render] depth exceeded: ${depth} > ${preRenderScrapeDepth}`)
        }
      }
    } catch (e) {
      console.error(red('[pre-render] process paths failed'), e)
    }
  }

  await processPaths()
  console.log(yellow(`[pre-render] pre-render finished: ${visitedPaths.length} pages rendered`))
}

export default preRender
