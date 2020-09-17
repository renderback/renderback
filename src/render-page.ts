import { Page } from 'puppeteer-core'
import { cyan, gray, red } from 'chalk'
import { minify } from 'html-minifier'
import config from './config'
import { PageScraper } from './page-scraper'
import { regexReplaceAll } from './content-rewrite'

async function renderPage(page: Page, pageScraper?: PageScraper, scrapeDepth?: number): Promise<[number, string]> {
  const { page: pageConfig } = config

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

  if (pageScraper && scrapeDepth) {
    await pageScraper.scrape(page, scrapeDepth)
  }

  if (config.urlRewrite.pathifyParams) {
    for (const [regex, replace] of config.urlRewrite.regex) {
      console.log(`[render-page] rewriting link URLs: ${regex} -> ${replace}`)
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(
        // eslint-disable-next-line no-loop-func
        (_regex: string, _replace: string, _origins: string[]) => {
          // eslint-disable-next-line no-undef
          document.querySelectorAll('a').forEach((element) => {
            const { href } = element
            const url = new URL(href)
            if (_origins.some((o) => o === url.origin)) {
              const newHref = element.href.replace(new RegExp(_regex, 'g'), _replace)
              const newUrl = new URL(newHref)

              // eslint-disable-next-line no-param-reassign
              element.href = `${newUrl.pathname}${
                newUrl.searchParams.toString() === '' ? '' : `?${newUrl.searchParams.toString()}`
              }`
            }
          })
        },
        regex,
        replace,
        config.origins
      )
    }
    await page.evaluate((origins: string[]) => {
      // eslint-disable-next-line no-undef
      document.querySelectorAll('a').forEach((element) => {
        const { href } = element
        const url = new URL(href)
        if (origins.some((o) => o === url.origin)) {
          const searchEntries = Array.from(url.searchParams.entries())
          if (searchEntries.length === 0) {
            return
          }
          searchEntries.sort((a1, a2) => {
            if (a1[0] === a2[0]) {
              return 0
            }
            if (a1[0] < a2[0]) {
              return -1
            }
            return 1
          })
          const newHref = `${url.pathname}/${searchEntries
            .map((searchEntry) => `${encodeURIComponent(searchEntry[0])}/${encodeURIComponent(searchEntry[1])}`)
            .join('/')}`

          console.log(`[render-page] setting new href: ${url} -> ${newHref}`)
          // eslint-disable-next-line no-param-reassign
          element.href = newHref
        }
      })
    }, config.origins)
  }

  if (config.rewrite.cssSelectorRemove) {
    for (const selector of config.rewrite.cssSelectorRemove) {
      console.log(`[render-page] removing by css selector: ${selector}`)
      // eslint-disable-next-line no-await-in-loop
      await page.$$eval(selector, (elements) => {
        elements.forEach((element) => {
          element.parentNode.removeChild(element)
        })
      })
    }
  }

  if (config.rewrite.cssSelectorUpdate) {
    for (const [selector, updateFunction] of config.rewrite.cssSelectorUpdate) {
      console.log(`[render-page] updating by css selector: ${selector} ${updateFunction}`)
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(
        // eslint-disable-next-line no-loop-func
        (selectorStr, functionStr) => {
          // eslint-disable-next-line no-undef
          document.querySelectorAll(selectorStr).forEach((element) => {
            // eslint-disable-next-line no-eval
            eval(functionStr)(element)
          })
        },
        selector,
        updateFunction
      )
    }
  }

  let content = await page.content()

  if (config.rewrite.regexReplace) {
    content = regexReplaceAll(content, config.rewrite.regexReplace)
  }

  if (config.rewrite.minify) {
    content = minify(content, config.rewrite.minify)
  }

  return [status, content]
}

export default renderPage
