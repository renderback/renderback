import { Page } from 'puppeteer-core'
import { cyan, gray, red } from 'chalk'
import config from './config'

const { page: pageConfig } = config

async function renderPage(page: Page): Promise<[number, string]> {
  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    console.log(`[render-page] wait for selector: ${pageConfig.waitSelector}`)
    await page.waitForSelector(pageConfig.waitSelector)
  } catch (err) {
    const content = await page.content()
    console.log(gray(`[render-page] page content:\n${content}`))
    console.error(red(`[render-page] wait for selector (${pageConfig.waitSelector}) timed-out`), err)
    throw new Error(`Wait for selector (${pageConfig.waitSelector}) timed out`)
  }

  if (pageConfig.statusCodeSelector) {
    // eslint-disable-next-line no-eval
    const status = Number(await page.$eval(pageConfig.statusCodeSelector, eval(pageConfig.statusCodeFunction)))
    if (status >= 200 && status < 300) {
      console.log(`[render-page] status: ${cyan(status)}`)
    } else {
      console.log(`[render-page] status: ${red(status)}`)
    }
    return [status, await page.content()]
  }

  return [200, await page.content()]
}

export default renderPage
