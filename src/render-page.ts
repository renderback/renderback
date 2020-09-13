import { Page } from 'puppeteer-core'
import config from './config'

const { page: pageConfig } = config

async function renderPage(page: Page): Promise<string> {
  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if your site lazy loads, etc.
    await page.waitForSelector(pageConfig.waitSelector) // ensure #posts exists in the DOM.
    await page.evaluate(() => {
      console.log(
        'Rendered title',
        // eslint-disable-next-line no-undef
        document.head.querySelector('title').innerText
      )
    })
  } catch (err) {
    console.error(err)
    throw new Error(`Wait for selector (${pageConfig.waitSelector}) timed out:\n${await page.content()}`)
  }

  return /* await */ page.content()
}

export default renderPage
