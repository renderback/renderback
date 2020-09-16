import { Browser, Page, Request } from 'puppeteer-core'
import { magenta, gray, red } from 'chalk'
import config from './config'

const { page: pageConfig } = config

const isRequestBlacklisted = (request: Request): boolean => {
  return pageConfig.requestBlacklist.map((pattern) => new RegExp(pattern)).some((regexp) => request.url().match(regexp))
}

const createPage = async (browser: Browser): Promise<Page> => {
  console.log('[create-page] creating page')
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  if (config.log.pageConsole) {
    page.on('console', async (msg) => {
      if (msg.args().length > 0) {
        console.log(`[page] console.${msg.type()}:`, ...(await Promise.all(msg.args().map((arg) => arg.jsonValue()))))
      }
    })
  }

  if (config.log.pageErrors) {
    page.on('pageerror', ({ message }) => console.log(red('[page] error:'), message))
  }
  if (config.log.pageResponses) {
    page.on('response', (response) => {
      console.log(gray(`[page] response: ${response.status()} ${response.url()}`))
    })
  }
  if (config.log.pageFailedRequests) {
    page.on('requestfailed', (request) => {
      const resourceRequest = ['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1
      if (
        request.failure()?.errorText !== 'net::ERR_ABORTED' &&
        ((resourceRequest && !pageConfig.abortResourceRequests) || (!resourceRequest && !isRequestBlacklisted(request)))
      ) {
        console.error(
          red(
            `[page] request failed: ${request.resourceType()} ${
              request.failure().errorText
            } ${request.url()} failure: ${request.failure()?.errorText}`
          ),
          request.failure()
        )
      }
    })
  }
  const resourcesToAbort = ['image', 'stylesheet', 'font']

  if (pageConfig.abortResourceRequests) {
    console.log(magenta(`[create-page] will abort resource requests: ${resourcesToAbort}`))
  } else {
    console.log(magenta(`[create-page] will NOT abort resource requests`))
  }
  if (pageConfig.requestBlacklist.length > 0) {
    console.log(magenta(`[create-page] will abort blacklisted requests: ${pageConfig.requestBlacklist}`))
  }

  page.on('request', (request) => {
    if (config.log.pageRequests) {
      console.log(gray(`[page] request - type==${request.resourceType()}: ${request.url()}`))
    }
    if (pageConfig.abortResourceRequests && resourcesToAbort.indexOf(request.resourceType()) !== -1) {
      if (config.log.pageAbortedRequests) {
        console.log(gray(`[page] request aborted - type==${request.resourceType()}: ${request.url()}`))
      }
      request.abort().catch(() => Promise.resolve())
    } else if (isRequestBlacklisted(request)) {
      if (config.log.pageAbortedRequests) {
        console.log(gray(`[page] request aborted - blacklist: ${request.url()}`))
      }
      request.abort().catch(() => Promise.resolve())
    } else {
      request.continue().catch(() => Promise.resolve())
    }
  })

  return page
}

export default createPage
