import puppeteer, { Browser } from 'puppeteer-core'
import config from './config'

const createBrowser = async (): Promise<Browser> => {
  if (config.browserWsEndpoint) {
    return puppeteer.connect({
      browserWSEndpoint: `${config.browserWsEndpoint}?--user-agent=${config.userAgent}`,
    })
  }
  if (config.browserExecutable) {
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
  console.error(
    'neither BROWSER_EXECUTABLE nor BROWSER_WS_ENDPOINT configured, exiting now'
  )
  process.exit(1)
  return Promise.reject()
}

export default createBrowser
