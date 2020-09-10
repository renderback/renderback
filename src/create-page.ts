import { Browser, Page, Request } from 'puppeteer-core'
import { PageConfig } from './config'

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
  if (pageConfig.logConsole) {
    page.on('console', async (msg) => {
      if (msg.args().length > 0) {
        console.log(
          `Page: console.${msg.type()}:`,
          ...(await Promise.all(msg.args().map((arg) => arg.jsonValue())))
        )
      }
    })
  }
  if (pageConfig.logErrors) {
    page.on('pageerror', ({ message }) => console.log('Page: error:', message))
  }
  if (pageConfig.logResponses) {
    page.on('response', (response) => {
      console.log(`Page: response: ${response.status()} ${response.url()}`)
    })
  }
  if (pageConfig.logFailedRequests) {
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
