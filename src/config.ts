import _ from 'lodash'
import fs from 'fs'
import os from 'os'
import yargsRaw from 'yargs'
import { envString, envNumber, envBoolean, envStringList } from './env-config'

export interface Config {
  browserExecutable?: string
  browserWsEndpoint?: string
  userAgent: string
  port: number
  enableCache: boolean
  adminAccessKey: string
  log: LogConfig
  page: PageConfig
  rules: RoutingRule[]
  preRender?: PreRenderConfig
  static?: StaticGenConfig
}

export interface PreRenderConfig {
  paths: string[]
}

export interface StaticGenConfig {
  output: string
}

export interface PageConfig {
  waitSelector: string
  resetScript: string
  navigateScript: string
  abortResourceRequests: boolean
  requestBlacklist: string[]
}

export interface LogConfig {
  headless?: boolean
  renderTime?: boolean
  requestsFromHeadless?: boolean
  cache?: boolean
  ruleMatch?: number // 0 -- disable
  precompressedAssets?: boolean
  pageLocation?: boolean
  pageErrors?: boolean
  pageConsole?: boolean
  pageResponses?: boolean
  pageFailedRequests?: boolean
}

export interface ProxyRoutingRule {
  rule: 'proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  modifyUrl?: string
}

export interface StaticAssetRoutingRule {
  rule: 'asset'
  ext?: string[]
  path?: string[]
  regex?: string[]
  dir: string
  maxAge?: number // default 31557600000
}

export interface StaticAssetProxyRoutingRule {
  rule: 'asset-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  modifyUrl?: string
}

export interface PageRoutingRule {
  rule: 'page'
  ext?: string[]
  path?: string[]
  regex?: string[]
  source: string
}

export interface PageProxyRoutingRule {
  rule: 'page-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  modifyUrl?: string
}

export interface NotFoundRoutingRule {
  rule: 'not-found'
  ext?: string[]
  path?: string[]
  regex?: string[]
}

export type RoutingRule =
  | ProxyRoutingRule
  | StaticAssetRoutingRule
  | StaticAssetProxyRoutingRule
  | PageRoutingRule
  | PageProxyRoutingRule
  | NotFoundRoutingRule

export interface EnvConfig {
  greenlockMaintainer?: string
  hostname: string
}

export interface RuntimeConfig {
  cacheEverything: boolean
}

const defaultConfig: Config = {
  browserExecutable: '/usr/bin/google-chrome-stable',
  userAgent: 'ssr/proxy',
  port: 80,
  enableCache: true,
  adminAccessKey: '',
  log: {
    headless: false,
    ruleMatch: 2,
    pageErrors: true,
    pageConsole: false,
    pageResponses: false,
    pageFailedRequests: true,
    precompressedAssets: false,
  },
  page: {
    waitSelector: 'title#title',
    resetScript: "document.head.querySelector('title').removeAttribute('id')",
    // eslint-disable-next-line no-template-curly-in-string
    navigateScript: "window.routeTo('${url}')",
    abortResourceRequests: true,
    requestBlacklist: [],
  },
  rules: [],
}

export const { argv } = yargsRaw
  .command('greenlock', 'start the greenlock server')
  .command('serve', 'start the server')
  .command('pre-render', 'pre-render the pages')
  .command('static-gen', 'generate the static site')
  .options({
    'pre-render': {
      boolean: true,
      description: 'Pre-render the pages',
      demandOption: false,
    },
    config: {
      type: 'string',
      description: 'Path to the configuration .json file',
      demandOption: false,
    },
    output: {
      type: 'string',
      description: 'Destination dir for the generated static site',
      demandOption: false,
    },
    'nginx-file': {
      type: 'string',
      description: 'Destination file for the static site nginx configuration',
      demandOption: false,
    },
  })
  .demandCommand(1, 1)

if (!argv.config) {
  console.log('using default configuration')
  const origin = envString('ORIGIN_BASE_URL')
  if (origin) {
    defaultConfig.rules.push({
      rule: 'page-proxy',
      ext: ['html'],
      target: origin,
    })
    defaultConfig.rules.push({
      rule: 'asset-proxy',
      path: ['/'],
      target: origin,
    })
  } else {
    console.warn(
      'ORIGIN_BASE_URL environment var is required (i.e. https://my-origin-server.somewhere)'
    )
    console.warn(
      'ORIGIN_BASE_URL environment var is missing, all requests will return 404 Not Found!'
    )
  }
} else {
  console.log(`will read configuration from ${argv.config}`)
}

const config: Config = argv.config
  ? _.merge({}, defaultConfig, JSON.parse(fs.readFileSync(argv.config, 'utf8')))
  : defaultConfig

config.browserExecutable =
  envString('BROWSER_EXECUTABLE') || config.browserExecutable
config.browserWsEndpoint =
  envString('BROWSER_WS_ENDPOINT') || config.browserWsEndpoint
config.userAgent = envString('USER_AGENT') || config.userAgent
config.port = envNumber('PORT') || config.port
config.adminAccessKey = envString('ADMIN_ACCESS_KEY') || config.adminAccessKey
config.enableCache = envBoolean('CACHE') || config.enableCache

config.log.headless = envBoolean('LOG_HEADLESS') || config.log.headless
config.log.requestsFromHeadless =
  envBoolean('LOG_REQUESTS_FROM_HEADLESS') || config.log.requestsFromHeadless
config.log.cache = envBoolean('LOG_CACHE') || config.log.cache
config.log.ruleMatch = envNumber('LOG_RULE_MATCH') || config.log.ruleMatch
config.log.precompressedAssets =
  envBoolean('LOG_PRECOMPRESSED_ASSETS') || config.log.precompressedAssets
config.log.pageErrors = envBoolean('LOG_PAGE_ERRORS') || config.log.pageErrors
config.log.pageConsole =
  envBoolean('LOG_PAGE_CONSOLE') || config.log.pageConsole
config.log.pageResponses =
  envBoolean('LOG_PAGE_RESPONSES') || config.log.pageResponses
config.log.pageFailedRequests =
  envBoolean('LOG_PAGE_FAILED_REQUESTS') || config.log.pageFailedRequests

config.page.waitSelector =
  envString('PAGE_WAIT_SELECTOR') || config.page.waitSelector
config.page.resetScript =
  envString('PAGE_RESET_SCRIPT') || config.page.resetScript
config.page.navigateScript =
  envString('PAGE_NAVIGATE_SCRIPT') || config.page.navigateScript
config.page.abortResourceRequests =
  envBoolean('PAGE_ABORT_RESOURCE_REQUESTS') ||
  config.page.abortResourceRequests
config.page.requestBlacklist =
  envStringList('PAGE_REQUEST_BLACKLIST') || config.page.requestBlacklist

export const envConfig: EnvConfig = {
  greenlockMaintainer: envString('GREENLOCK_MAINTAINER'),
  hostname: os.hostname(),
}

console.log(JSON.stringify(config, null, 4))
console.log('env config', JSON.stringify(envConfig, null, 4))

export const runtimeConfig: RuntimeConfig = {
  cacheEverything: false,
}

export default config
