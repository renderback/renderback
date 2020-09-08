let RENDER_CACHE = new Map()

function clearCache() {
  RENDER_CACHE = new Map()
  console.log('Cache cleared.')
}

async function ssrAll(browser, target, paths, cacheResponses, pageConfig) {
  const page = await createPage(browser, pageConfig)

  console.log(`Pre-render: navigating to: ${target}/`)
  const start = Date.now()
  await page.goto(`${target}/`, {waitUntil: 'networkidle0'})
  const html = await doSSR(browser, page, pageConfig)
  const ttRenderMs = Date.now() - start
  console.info(`Rendered page ${target}/ in: ${ttRenderMs}ms.`)
  if (cacheResponses) {
    RENDER_CACHE.set(`${target}/`, html)
    console.info(`Saved to cache.`)
  }

  const processPath = async path => {
    const url = `${target}${path}`
    const start = Date.now()
    console.log(`Pre-render: navigating to: ${url}`)
    await page.evaluate((resetSelectorScript, navigateScript) => {
      eval(resetSelectorScript)
      eval(navigateScript)
    }, pageConfig.resetSelectorScript, pageConfig.navigateScript.replace("${url}", `${url}`))

    const html = await doSSR(browser, page, pageConfig)
    const ttRenderMs = Date.now() - start
    console.info(`Rendered page ${url} in: ${ttRenderMs}ms.`)
    if (cacheResponses) {
      RENDER_CACHE.set(`${url}`, html)
      console.info(`Saved to cache.`)
    }
  }


  const processPaths = async (paths) => {
    for (const path of paths) {
      await processPath(path)
    }
  }

  await processPaths(paths)
}

async function ssr(url, browser, cacheResponses, pageConfig) {
  if (cacheResponses && RENDER_CACHE.has(url)) {
    console.log('Serving from cache:', url)
    return {html: RENDER_CACHE.get(url), ttRenderMs: 0}
  }

  const start = Date.now()
  const page = await createPage(browser, pageConfig)
  console.log(`Navigating to:`, url)
  await page.goto(url, {waitUntil: 'networkidle0'})
  const html = await doSSR(browser, page, pageConfig)
  await page.close()
  const ttRenderMs = Date.now() - start
  console.info(`Rendered page ${url} in: ${ttRenderMs}ms.`)

  if (cacheResponses) {
    RENDER_CACHE.set(url, html)
    console.info(`Saved to cache.`)
  }

  return {html, ttRenderMs}
}

async function doSSR(browser, page, pageConfig) {
  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if your site lazy loads, etc.
    await page.waitForSelector(pageConfig.waitSelector) // ensure #posts exists in the DOM.
    await page.evaluate(() => {
      console.log('Rendered title', document.head.querySelector('title').innerText)
    })
  } catch (err) {
    console.error(err)
    throw new Error(`Wait for selector (${pageConfig.waitSelector}) timed out:\n${await page.content()}`)
  }

  return await page.content()
}

async function createPage(browser, pageConfig) {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  if (pageConfig.logConsole) {
    page
      .on('console', async msg => {
        if (msg.args().length > 0) {
          console.log(
            `Page: console.${msg._type}:`,
            ...await Promise.all(msg.args().map(arg => arg.jsonValue()))
          )
        }
      })
  }
  if (pageConfig.logErrors) {
    page.on('pageerror', ({message}) => console.log('Page: error:', message))
  }
  if (pageConfig.logResponses) {

    page.on('response', response => {
      console.log(`Page: response: ${response.status()} ${response.url()}`)
    })
  }
  if (pageConfig.logFailedRequests) {
    page.on('requestfailed', request => {
      const resourceRequest = ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
      if (
        (resourceRequest && !pageConfig.abortResourceRequests) ||
        (!resourceRequest && !isRequestBlacklisted(request, pageConfig))
      ) {
        console.error(`Page: request failed: ${request.resourceType()} ${request.failure().errorText} ${request.url()}`, request.failure())
      }
    })
  }
  page.on('request', (request) => {
    if (pageConfig.abortResourceRequests && ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
      request.abort()
    } else if (isRequestBlacklisted(request, pageConfig)) {
      console.log('Blacklisting request:', request.url())
      request.abort()
    } else {
      request.continue()
    }
  })

  return page
}

function isRequestBlacklisted(request, pageConfig) {
  return pageConfig.requestBlacklist.map(pattern => new RegExp(pattern)).some(regexp => request.url().match(regexp))
}

export {ssr as default, ssrAll, clearCache}
