import { Browser, Page, Request } from 'puppeteer-core'
import config, { PageConfig } from './config'

const isRequestBlacklisted = (
  request: Request,
  pageConfig: PageConfig
): boolean => {
  return pageConfig.requestBlacklist
    .map((pattern) => new RegExp(pattern))
    .some((regexp) => request.url().match(regexp))
}

const createPage = async (
  browser: Browser,
  pageConfig: PageConfig
): Promise<Page> => {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  if (config.log.pageConsole) {
    page.on('console', async (msg) => {
      if (msg.args().length > 0) {
        console.log(
          `Page: console.${msg.type()}:`,
          ...(await Promise.all(msg.args().map((arg) => arg.jsonValue())))
        )
      }
    })
  }
  if (config.log.pageErrors) {
    page.on('pageerror', ({ message }) => console.log('Page: error:', message))
  }
  if (config.log.pageResponses) {
    page.on('response', (response) => {
      console.log(`Page: response: ${response.status()} ${response.url()}`)
    })
  }
  if (config.log.pageFailedRequests) {
    page.on('requestfailed', (request) => {
      const resourceRequest =
        ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
      if (
        (resourceRequest && !pageConfig.abortResourceRequests) ||
        (!resourceRequest && !isRequestBlacklisted(request, pageConfig))
      ) {
        console.error(
          `Page: request failed: ${request.resourceType()} ${
            request.failure().errorText
          } ${request.url()}`,
          request.failure()
        )
      }
    })
  }
  page.on('request', (request) => {
    if (
      pageConfig.abortResourceRequests &&
      ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
    ) {
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

export default createPage
