import { Page } from 'puppeteer-core'
import { cyan, gray, red } from 'chalk'
import config from './config'

const { page: pageConfig } = config

async function renderPage(page: Page, origins: string[], pathifySingleParams?: boolean): Promise<[number, string]> {
  try {
    console.log(`[render-page] wait for selector: ${pageConfig.waitSelector}`)
    await page.waitForSelector(pageConfig.waitSelector)
  } catch (err) {
    const content = await page.content()
    console.log(gray(`[render-page] page content:\n${content}`))
    console.error(red(`[render-page] wait for selector (${pageConfig.waitSelector}) timed-out`), err)
    throw new Error(`Wait for selector (${pageConfig.waitSelector}) timed out`)
  }

  let status = 200
  if (pageConfig.statusCodeSelector !== '') {
    // eslint-disable-next-line no-eval
    status = Number(await page.$eval(pageConfig.statusCodeSelector, eval(pageConfig.statusCodeFunction)))
    if (status >= 200 && status < 300) {
      console.log(`[render-page] status: ${cyan(status)}`)
    } else {
      console.log(`[render-page] status: ${red(status)}`)
    }
  }

  if (pathifySingleParams) {
    await page.$$eval('a', (elements) => {
      elements.forEach((element: any) => {
        const { href } = element
        const url = new URL(href)
        if (origins.some((o) => o === url.origin)) {
          const searchEntries = Array.from(url.searchParams.entries())
          if (searchEntries.length === 1) {
            // eslint-disable-next-line no-param-reassign
            element.href = `${href}/${encodeURIComponent(searchEntries[0][0])}/${encodeURIComponent(
              searchEntries[0][1]
            )}`
          }
        }
      })
    })
  }

  return [status, await page.content()]
}

export default renderPage
