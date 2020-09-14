import puppeteer, { Browser } from 'puppeteer-core'
import { green, red } from 'chalk'
import config from './config'

const createBrowser = async (): Promise<Browser> => {
  if (config.browserWsEndpoint) {
    console.log(green(`[create-browser] connecting to browser: ${config.browserWsEndpoint}`))
    return puppeteer.connect({
      browserWSEndpoint: `${config.browserWsEndpoint}?--user-agent=${config.userAgent}`,
    })
  }
  if (config.browserExecutable) {
    console.log(green(`[create-browser] launching browser: ${config.browserExecutable}`))
    return puppeteer.launch({
      product: 'chrome',
      ignoreHTTPSErrors: true,
      headless: true,
      executablePath: config.browserExecutable,
      args: [
        '--ignore-certificate-errors',
        `--user-agent=${config.userAgent}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
      ],
    })
  }
  console.error(red('[create-browser] neither BROWSER_EXECUTABLE nor BROWSER_WS_ENDPOINT configured'))
  process.exit(1)
  return Promise.reject()
}

export default createBrowser
