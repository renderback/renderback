import puppeteer, { Browser } from 'puppeteer-core'
import config from './config'

const createBrowser = async (): Promise<Browser> => {
  return puppeteer.launch({
    product: 'chrome',
    ignoreHTTPSErrors: true,
    headless: true,
    executablePath: config.browserExecutablePath,
    args: [
      '--ignore-certificate-errors',
      `--user-agent=${config.userAgent}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
  })
}

export default createBrowser
