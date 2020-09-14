import { Page } from 'puppeteer-core'
import { gray, red } from 'chalk'
import config from './config'

const { page: pageConfig } = config

async function renderPage(page: Page): Promise<string> {
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

  return /* await */ page.content()
}

export default renderPage
