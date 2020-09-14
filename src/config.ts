import _ from 'lodash'
import fs from 'fs'
import os from 'os'
import yargsRaw from 'yargs'
import { envString, envNumber, envBoolean, envStringList } from './env-config'

export interface Config {
  browserExecutable?: string
  browserWsEndpoint?: string
  userAgent: string
  httpPort: number
  enableCache: boolean
  adminAccessKey: string
  preRender: boolean
  log: LogConfig
  page: PageConfig
  routes: Route[]
  preRenderPaths: []
  static?: StaticSiteConfig
}

export interface StaticSiteConfig {
  contentOutput?: string
  nginxConfigFile?: string
  nginxServerName?: string
  pageReplace?: [[string, string]]
  nginxExtraConfig?: any
  notFoundPage?: string
  errorCodes: number[]
  errorPage?: string
}

export interface PageConfig {
  waitSelector: string
  statusCodeSelector?: string
  statusCodeFunction?: string
  preNavigationScript?: string
  navigateFunction: string
  abortResourceRequests: boolean
  requestBlacklist: string[]
}

export interface LogConfig {
  navigation?: boolean
  renderTime?: boolean
  selfRequests?: boolean
  routeMatch?: number // 0 -- disable
  pageLocation?: boolean
  pageErrors?: boolean
  pageConsole?: boolean
  pageResponses?: boolean
  pageAbortedRequests?: boolean
  pageFailedRequests?: boolean
}

export interface ProxyRoute {
  type: 'proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  modifyUrl?: string
  nginxExtraConfig?: any
}

export interface AssetRoute {
  type: 'asset'
  ext?: string[]
  path?: string[]
  regex?: string[]
  dir: string
  maxAge?: number // default 31557600000
  nginxExtraConfig?: any
  nginxExpires?: string
  nginxCacheControlPublic?: boolean
}

export interface AssetProxyRoute {
  type: 'asset-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  nginxExtraConfig?: any
  nginxExpires?: string
  nginxCacheControlPublic?: boolean
}

export interface PageRoute {
  type: 'page'
  ext?: string[]
  path?: string[]
  regex?: string[]
  source: string
  nginxExtraConfig?: any
}

export interface PageProxyRoute {
  type: 'page-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  nginxExtraConfig?: any
}

export interface NotFoundRoute {
  type: 'not-found'
  ext?: string[]
  path?: string[]
  regex?: string[]
}

export type Route = ProxyRoute | AssetRoute | AssetProxyRoute | PageRoute | PageProxyRoute | NotFoundRoute

export interface EnvConfig {
  greenlock: boolean
  greenlockMaintainer?: string
  hostname: string
}

export interface RuntimeConfig {
  cacheEverything: boolean
}

const defaultConfig: Config = {
  browserExecutable: '/usr/bin/google-chrome-stable',
  userAgent: 'ssr/proxy',
  httpPort: 40080,
  enableCache: true,
  preRender: false,
  preRenderPaths: [],
  adminAccessKey: '',
  page: {
    waitSelector: 'title[data-status]',
    preNavigationScript: "document.head.querySelector('title').removeAttribute('data-status')",
    statusCodeSelector: 'title[data-status]',
    statusCodeFunction: '(e) => e.dataset.status',
    // eslint-disable-next-line no-template-curly-in-string
    navigateFunction: '(url) => window.location.href = url',
    abortResourceRequests: true,
    requestBlacklist: [],
  },
  log: {
    navigation: false,
    routeMatch: 2,
    pageErrors: true,
    pageConsole: false,
    pageResponses: false,
    pageAbortedRequests: false,
    pageFailedRequests: true,
  },
  routes: [],
  static: {
    errorCodes: [500, 502],
  },
}

export const { argv } = yargsRaw
  .command('start', 'start the server')
  .command('static-site', 'generate the static site')
  .options({
    config: {
      type: 'string',
      description: 'Path to the configuration .json file',
      demandOption: false,
    },
    'browser-executable': {
      type: 'string',
      description: 'Path to the browser executable',
      demandOption: false,
    },
    'browser-ws-endpoint': {
      type: 'string',
      description: 'Browser WS endpoint url',
      demandOption: false,
    },
    'user-agent': {
      type: 'string',
      description: 'User Agent to be used by the browser',
      demandOption: false,
    },
    'http-port': {
      type: 'number',
      description: 'Port to bind the http server to (default 40080)',
      demandOption: false,
    },
    'enable-cache': {
      boolean: true,
      description: 'Enable the rendered pages cache',
      demandOption: false,
    },
    'pre-render': {
      boolean: true,
      description: 'Pre-render the pages',
      demandOption: false,
    },
    'pre-render-paths': {
      type: 'array',
      description: 'Paths to pre-render (besides /)',
      demandOption: false,
    },
    'log-navigation': {
      boolean: true,
      description: 'Log browser navigation',
      demandOption: false,
    },
    'log-self-requests': {
      boolean: true,
      description: 'Log requests from the rendering browser',
      demandOption: false,
    },
    'log-render-time': {
      boolean: true,
      description: 'Log rendering timings',
      demandOption: false,
    },
    'log-route-match': {
      type: 'number',
      description: 'Log matched routes, 0..2 (default 2)',
      demandOption: false,
    },
    'log-page-errors': {
      boolean: true,
      description: 'Log page errors',
      demandOption: false,
    },
    'log-page-console': {
      boolean: true,
      description: 'Log page console',
      demandOption: false,
    },
    'log-page-responses': {
      boolean: true,
      description: 'Log page HTTP responses',
      demandOption: false,
    },
    'log-page-aborted-requests': {
      boolean: true,
      description: 'Log page aborted HTTP requests',
      demandOption: false,
    },
    'log-page-failed-requests': {
      boolean: true,
      description: 'Log page failed HTTP requests',
      demandOption: false,
    },
    'page-wait-selector': {
      type: 'string',
      description: 'CSS selector to wait on when rendering pages (default "title[data-status]")',
      demandOption: false,
    },
    'page-status-code-selector': {
      type: 'string',
      description: 'CSS selector of the element to extract the status code from (default "title[data-status]")',
      demandOption: false,
    },
    'page-status-code-function': {
      type: 'string',
      description:
        'JavaScript function to extract the status code from the element (default "(e) => e.dataset.status")',
      demandOption: false,
    },
    'page-navigate-function': {
      type: 'string',
      description: 'JavaScript function body to be used to navigate to pages (when pre-rendering)',
      demandOption: false,
    },
    'page-pre-navigation-script': {
      type: 'string',
      description:
        "JavaScript script to be run in the page before navigating to the next URL when pre-rendering (default \"document.head.querySelector('title').removeAttribute('data-status')\")",
      demandOption: false,
    },
    'page-abort-resource-requests': {
      boolean: true,
      description: 'Abort image/css/font requests when rendering pages (default: true)',
      demandOption: false,
    },
    'page-request-blacklist': {
      type: 'array' as const,
      description: 'Regular expressions for URLs to abort when rendering pages',
      demandOption: false,
    },
    'static-content-output': {
      type: 'string',
      description: 'Path to the target directory for the content files (static site)',
      demandOption: false,
    },
    'static-nginx-config-file': {
      type: 'string',
      description: 'Path to the target file for nginx config file (static site)',
      demandOption: false,
    },
    'static-nginx-server-name': {
      type: 'string',
      description: 'server_name for the nginx config file (static site)',
      demandOption: false,
    },
    'static-not-found-page': {
      type: 'string',
      description: 'URL of the page to use as a Not Found page (static site)',
      demandOption: false,
    },
    'static-error-page': {
      type: 'string',
      description: 'URL of the page to use as an error page (static site)',
      demandOption: false,
    },
    'static-error-codes': {
      type: 'string',
      description: 'A list of status codes for which to configure the error page (static site)',
      demandOption: false,
    },
    'origin-base-url': {
      type: 'string',
      description: 'Origin base URL (when using the default config)',
      demandOption: false,
    },
  })
  .demandCommand(1, 1)

if (!argv.config) {
  console.log('using default configuration')
  const origin = argv['origin-base-url'] || envString('ORIGIN_BASE_URL')
  if (origin) {
    defaultConfig.routes.push({
      type: 'page-proxy',
      ext: ['html'],
      target: origin,
    })
    defaultConfig.routes.push({
      type: 'asset-proxy',
      path: ['/'],
      target: origin,
    })
  } else {
    console.warn('ORIGIN_BASE_URL environment var is required (i.e. https://my-origin-server.somewhere)')
    console.warn('ORIGIN_BASE_URL environment var is missing, all requests will return 404 Not Found!')
  }
} else {
  console.log(`will read configuration from ${argv.config}`)
}

const config: Config = argv.config
  ? _.merge({}, defaultConfig, JSON.parse(fs.readFileSync(argv.config, 'utf8')))
  : defaultConfig

config.browserExecutable = argv['browser-executable'] || envString('BROWSER_EXECUTABLE') || config.browserExecutable
config.browserWsEndpoint = argv['browser-ws-endpoint'] || envString('BROWSER_WS_ENDPOINT') || config.browserWsEndpoint
config.userAgent = argv['user-agent'] || envString('USER_AGENT') || config.userAgent
config.httpPort = argv['http-port'] || envNumber('HTTP_PORT') || config.httpPort
config.adminAccessKey = envString('ADMIN_ACCESS_KEY') || config.adminAccessKey
config.enableCache = argv['enable-cache'] || envBoolean('ENABLE_CACHE') || config.enableCache

config.log.navigation = argv['log-navigation'] || envBoolean('LOG_NAVIGATION') || config.log.navigation
config.log.selfRequests = argv['log-self-requests'] || envBoolean('LOG_SELF_REQUESTS') || config.log.selfRequests
config.log.renderTime = argv['log-render-time'] || envBoolean('LOG_RENDER_TIME') || config.log.renderTime
config.log.routeMatch = argv['log-route-match'] || envNumber('LOG_ROUTE_MATCH') || config.log.routeMatch
config.log.pageErrors = argv['log-page-errors'] || envBoolean('LOG_PAGE_ERRORS') || config.log.pageErrors
config.log.pageConsole = argv['log-page-console'] || envBoolean('LOG_PAGE_CONSOLE') || config.log.pageConsole
config.log.pageResponses = argv['log-page-responses'] || envBoolean('LOG_PAGE_RESPONSES') || config.log.pageResponses
config.log.pageAbortedRequests =
  argv['log-page-aborted-requests'] || envBoolean('LOG_PAGE_ABORTED_REQUESTS') || config.log.pageAbortedRequests
config.log.pageFailedRequests =
  argv['log-page-failed-requests'] || envBoolean('LOG_PAGE_FAILED_REQUESTS') || config.log.pageFailedRequests

config.page.waitSelector = argv['page-wait-selector'] || envString('PAGE_WAIT_SELECTOR') || config.page.waitSelector
config.page.statusCodeSelector =
  argv['page-status-code-selector'] || envString('PAGE_STATUS_CODE_SELECTOR') || config.page.statusCodeSelector
config.page.statusCodeFunction =
  argv['page-status-code-function'] || envString('PAGE_STATUS_CODE_FUNCTION') || config.page.statusCodeFunction
config.page.preNavigationScript =
  argv['page-pre-navigation-script'] || envString('PAGE_PRE_NAVIGATION_SCRIPT') || config.page.preNavigationScript
config.page.navigateFunction =
  argv['page-navigate-function'] || envString('PAGE_NAVIGATE_FUNCTION') || config.page.navigateFunction

config.page.abortResourceRequests =
  argv['page-abort-resource-requests'] ||
  envBoolean('PAGE_ABORT_RESOURCE_REQUESTS') ||
  config.page.abortResourceRequests

config.page.requestBlacklist =
  (argv['page-request-blacklist'] ? argv['page-request-blacklist'].map((s) => String(s)) : undefined) ||
  envStringList('PAGE_REQUEST_BLACKLIST') ||
  config.page.requestBlacklist

config.static.contentOutput =
  argv['static-content-output'] || envString('STATIC_CONTENT_OUTPUT') || config.static.contentOutput
config.static.nginxConfigFile =
  argv['static-nginx-config-file'] || envString('STATIC_NGINX_CONFIG_FILE') || config.static.nginxConfigFile
config.static.nginxServerName =
  argv['static-nginx-server-name'] || envString('STATIC_NGINX_SERVER_NAME') || config.static.nginxServerName
config.static.notFoundPage =
  argv['static-not-found-page'] || envString('STATIC_NOT_FOUND_PAGE') || config.static.notFoundPage
config.static.errorPage = argv['static-error-page'] || envString('STATIC_ERROR_PAGE') || config.static.errorPage
config.static.errorCodes =
  (argv['static-error-codes'] ? argv['static-error-codes'].map((s) => Number(s)) : undefined) ||
  config.static.errorCodes

export const envConfig: EnvConfig = {
  greenlock: envBoolean('GREENLOCK'),
  greenlockMaintainer: envString('GREENLOCK_MAINTAINER'),
  hostname: os.hostname(),
}

console.log(JSON.stringify(config, null, 4))
console.log('env config', JSON.stringify(envConfig, null, 4))

export const runtimeConfig: RuntimeConfig = {
  cacheEverything: false,
}

export default config
