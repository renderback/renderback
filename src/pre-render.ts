import { blueBright, yellow, magenta } from 'chalk'
import { Request } from 'puppeteer-core'
import createPage from './create-page'
import renderPage from './render-page'
import { cachePageRenderResult } from './cache'
import config, { envConfig } from './config'
import createBrowser from './create-browser'
import { renderTimeMetric } from './metrics'
import { snooze } from './util'
import { PageScraper } from './page-scraper'

const preRender = async (): Promise<{ pagesRendered: number }> => {
  const { preRender: preRenderConfig, page: pageConfig } = config
  if (!preRenderConfig) {
    console.error(`pre-render is not configured`)
    return { pagesRendered: 0 }
  }
  if (!preRenderConfig.enabled) {
    console.error(`pre-render is not enabled`)
    return { pagesRendered: 0 }
  }
  const target = `http://${envConfig.hostname}:${config.httpPort}`

  const browser = await createBrowser()
  let page = await createPage(browser)

  const { paths, scrape, scrapeDepth } = preRenderConfig

  const pageScraper = new PageScraper(scrapeDepth, config.origins)
  pageScraper.seen([...(paths || ['/'])])
  pageScraper.pathsToVisit(
    (paths?.length > 0 ? paths : ['/']).map((path, index) => ({
      path,
      initial: index === 0,
      depth: 1,
    }))
  )
  // const pathsToVisit: { path: string; initial: boolean; depth: number }[] = console.log(
  //   'initial paths to visit',
  //   pathsToVisit
  // )

  // const seenPaths: string[] = [...(paths || ['/'])]
  // const visitedPaths: string[] = []

  const processPath = async (path: string, initial: boolean, depth: number) => {
    console.log(`[pre-render] processing path: ${path} depth: ${depth}${initial ? ' initial' : ''}`)
    const url = `${target}${path}`
    const pathStart = Date.now()
    const timerHandle = renderTimeMetric.startTimer({ url })
    let redirects: Request[] | undefined
    if (initial) {
      console.log(`[pre-render] navigating to: ${yellow(url)} (initial)`)
      const response = await page.goto(url, { waitUntil: 'networkidle0' }) // networkidle0 waits for the network to be idle (no requests for 500ms).
      redirects = response.request().redirectChain()
    } else {
      if (pageConfig.preNavigationScript) {
        if (config.log.navigation) {
          console.log(`[pre-render] running pre-navigation script`)
        }
        await page.evaluate((preNavigationScript) => {
          // eslint-disable-next-line no-eval
          eval(preNavigationScript)
        }, pageConfig.preNavigationScript)
        console.log('[pre-render] wait for navigation...')
      }

      if (pageConfig.navigateFunction) {
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
        await page.waitForNavigation({ waitUntil: 'networkidle0' }) // networkidle0 waits for the network to be idle (no requests for 500ms).
      } else {
        if (config.log.navigation) {
          console.log(`[pre-render] navigating to: ${yellow(url)}`)
        }
        const response = await page.goto(url, { waitUntil: 'networkidle0' }) // networkidle0 waits for the network to be idle (no requests for 500ms).
        redirects = response.request().redirectChain()
      }
    }

    const [status, html] = await renderPage(page, config.origins)
    timerHandle()
    const pathRenderMs = Date.now() - pathStart
    if (config.log.renderTime) {
      console.info(`[pre-render] rendered ${url}: ${yellow(`${pathRenderMs}ms`)}`)
    }

    cachePageRenderResult({ url, html, status, redirects })
    if (scrape) {
      await pageScraper.scrape(page, depth)
    }
    if (!pageConfig.navigateFunction) {
      await page.close()
      page = await createPage(browser)
    }
  }

  const processPaths = async () => {
    const nextPathToVisit = pageScraper.shift()
    if (!nextPathToVisit) {
      return
    }
    console.log(magenta(`[pre-render] considering path: ${JSON.stringify(nextPathToVisit)}`))
    const { path, initial, depth } = nextPathToVisit

    // eslint-disable-next-line no-await-in-loop
    await processPath(path, initial, depth)
    console.log(magenta(`[pre-render] path to visit remaining: ${pageScraper.remaining()}`))
    if (preRenderConfig.pause) {
      console.log(blueBright(`[pre-render] pause between pages: ${preRenderConfig.pause}ms`))
      await snooze(preRenderConfig.pause)
    }
    await processPaths()
  }

  await processPaths()
  console.log(yellow(`[pre-render] pre-render finished: ${pageScraper.pathsVisited()} pages rendered`))
  return { pagesRendered: pageScraper.pathsVisited() }
}

export default preRender
