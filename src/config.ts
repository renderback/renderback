import _ from 'lodash'
import fs from 'fs'
import os from 'os'
import yargsRaw from 'yargs'
import htmlMinifier from 'html-minifier'
import {
  envString,
  envNumber,
  envBoolean,
  envStringList,
  envNumberList,
  argvStringList,
  argvNumberList,
  argvJson,
  envJson,
  argvStringTupleList,
  envStringTupleList,
} from './config-utils'

export interface Config {
  browserExecutable?: string
  browserWsEndpoint?: string
  userAgent: string
  httpPort: number
  enableCache: boolean
  adminAccessKey: string
  origins: string[]
  preRender: PreRenderConfig
  log: LogConfig
  page: PageConfig
  routes: Route[]
  rewrite: ContentRewriteConfig
  urlRewrite: UrlRewriteConfig
  static?: StaticSiteConfig
}

export interface ContentRewriteConfig {
  minify?: htmlMinifier.Options
  regexReplace?: [string, string][]
  cssSelectorRemove?: string[]
  cssSelectorUpdate?: [string, string][]
}

export interface UrlRewriteConfig {
  regex: [string, string][]
  pathifyParams: boolean
}

export interface PreRenderConfig {
  enabled: boolean
  exclude: string[]
  scrape: boolean
  paths?: string[]
  scrapeDepth?: number
  pause?: number
}

export interface StaticSiteConfig {
  contentOutput?: string
  dirIndex: boolean
  nginx?: StaticSiteNginxConfig
  s3?: StaticSiteS3Config
}

export interface StaticSiteNginxConfig {
  configFile: string
  serverName?: string
  extraConfig?: unknown
  notFoundPage?: string
  errorCodes: number[]
  errorPage?: string
}

export interface StaticSiteS3Config {
  uploadScript: string
  bucketName: string
  awsProfile: string
}

export interface PageConfig {
  waitSelector: string
  statusCodeSelector: string
  statusCodeFunction: string
  preNavigationScript?: string
  navigateFunction?: string
  abortResourceRequests: boolean
  requestBlacklist: string[]
}

export interface LogConfig {
  navigation: boolean
  renderTime: boolean
  selfRequests: boolean
  routeMatch: number // 0 -- disable
  pageErrors: boolean
  pageConsole: boolean
  pageRequests: boolean
  pageResponses: boolean
  pageAbortedRequests: boolean
  pageFailedRequests: boolean
  cache: boolean
}

export interface ProxyRoute {
  type: 'proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  modifyUrl?: string
  nginxExtraConfig?: unknown
}

export interface AssetRoute {
  type: 'asset'
  ext?: string[]
  path?: string[]
  regex?: string[]
  dir: string
  maxAge?: number // default 31557600000
  nginxExtraConfig?: unknown
  nginxExpires?: string
  nginxCacheControlPublic?: boolean
}

export interface AssetProxyRoute {
  type: 'asset-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  nginxExtraConfig?: unknown
  nginxExpires?: string
  nginxCacheControlPublic?: boolean
}

export interface PageRoute {
  type: 'page'
  ext?: string[]
  path?: string[]
  regex?: string[]
  source: string
  nginxExtraConfig?: unknown
}

export interface PageProxyRoute {
  type: 'page-proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
  nginxExtraConfig?: unknown
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
  adminAccessKey: '',
  origins: [],
  page: {
    waitSelector: 'title[data-status]',
    preNavigationScript: "document.head.querySelector('title').removeAttribute('data-status')",
    statusCodeSelector: 'title[data-status]',
    statusCodeFunction: '(e) => e.dataset.status',
    abortResourceRequests: true,
    requestBlacklist: [],
  },
  log: {
    navigation: false,
    renderTime: true,
    selfRequests: false,
    routeMatch: 2,
    pageErrors: true,
    pageConsole: false,
    pageResponses: false,
    pageRequests: false,
    pageAbortedRequests: false,
    pageFailedRequests: true,
    cache: false,
  },
  preRender: {
    enabled: false,
    scrape: false,
    exclude: [],
  },
  routes: [],
  rewrite: {},
  urlRewrite: {
    pathifyParams: false,
    regex: [],
  },
  static: {
    dirIndex: false,
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
    origins: {
      type: 'array',
      description: 'Origins to consider part of the site (when scraping, rewriting links, etc)',
      demandOption: false,
    },
    'url-rewrite-pathify-params': {
      boolean: true,
      description: 'Replace ..path?param=value with ..path/param/value',
      demandOption: false,
    },
    'url-rewrite-regex': {
      type: 'array',
      description: 'Rewrite URLs using regular expressions (ex. "\\/prefix\\/ \\/")',
      demandOption: false,
    },
    'pre-render': {
      boolean: true,
      description: 'Pre-render the pages',
      demandOption: false,
    },
    'pre-render-scrape': {
      boolean: true,
      description: 'Scrape the pages to pre-render',
      demandOption: false,
    },
    'pre-render-scrape-depth': {
      type: 'number',
      description: 'Scrape depth',
      demandOption: false,
    },
    'pre-render-pause': {
      type: 'number',
      description: 'Pause between pages (millis)',
      demandOption: false,
    },
    'pre-render-paths': {
      type: 'array',
      description: 'Paths to pre-render',
      demandOption: false,
    },
    'pre-render-exclude': {
      type: 'array',
      description: 'Paths to exclude from pre-render (regexp)',
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
    'log-page-requests': {
      boolean: true,
      description: 'Log page HTTP requests',
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
    'log-cache': {
      boolean: true,
      description: 'Log caching',
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
      type: 'array',
      description: 'A list of status codes for which to configure the error page (static site)',
      demandOption: false,
    },
    'static-dir-index': {
      boolean: true,
      description: 'Output pages at URLs without an extension a dir index (/path/to/page/index.html) (static site)',
      demandOption: false,
    },
    'origin-base-url': {
      type: 'string',
      description: 'Origin base URL (when using the default config)',
      demandOption: false,
    },
    'static-s3-upload-script': {
      type: 'string',
      description: 'Path to the target file for s3 upload script (static site)',
      demandOption: false,
    },
    'static-s3-bucket-name': {
      type: 'string',
      description: 'Bucket name to be used in the upload script (static site)',
      demandOption: false,
    },
    'static-s3-aws-profile': {
      type: 'string',
      description: 'AWS profile to be used in the upload script (static site)',
      demandOption: false,
    },
    'rewrite-minify': {
      type: 'string',
      description: 'Options for html-minify (JSON object), "{}" to enable and use defaults',
      demandOption: false,
    },
    'rewrite-css-selector-remove': {
      type: 'array',
      description: 'CSS selectors to remove from page',
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
config.origins = argvStringList(argv.origins) || envStringList('ORIGINS') || config.origins

config.preRender = {
  ...(config.preRender || {}),
  ...{
    enabled: argv['pre-render'] || envBoolean('PRE_RENDER') || config.preRender?.enabled,
    paths: argvStringList(argv['pre-render-paths']) || envStringList('PRE_RENDER_PATHS') || config.preRender?.paths,
    exclude:
      argvStringList(argv['pre-render-exclude']) || envStringList('PRE_RENDER_EXCLUDE') || config.preRender?.exclude,
    scrape: argv['pre-render-scrape'] || envBoolean('PRE_RENDER_SCRAPE') || config.preRender?.scrape,
    scrapeDepth:
      argv['pre-render-scrape-depth'] || envNumber('PRE_RENDER_SCRAPE_DEPTH') || config.preRender?.scrapeDepth,
    pause: argv['pre-render-pause'] || envNumber('PRE_RENDER_PAUSE') || config.preRender?.pause,
  },
}

config.log.navigation = argv['log-navigation'] || envBoolean('LOG_NAVIGATION') || config.log.navigation
config.log.selfRequests = argv['log-self-requests'] || envBoolean('LOG_SELF_REQUESTS') || config.log.selfRequests
config.log.renderTime = argv['log-render-time'] || envBoolean('LOG_RENDER_TIME') || config.log.renderTime
config.log.routeMatch = argv['log-route-match'] || envNumber('LOG_ROUTE_MATCH') || config.log.routeMatch
config.log.pageErrors = argv['log-page-errors'] || envBoolean('LOG_PAGE_ERRORS') || config.log.pageErrors
config.log.pageConsole = argv['log-page-console'] || envBoolean('LOG_PAGE_CONSOLE') || config.log.pageConsole
config.log.pageResponses = argv['log-page-responses'] || envBoolean('LOG_PAGE_RESPONSES') || config.log.pageResponses
config.log.pageRequests = argv['log-page-requests'] || envBoolean('LOG_PAGE_REQUESTS') || config.log.pageRequests
config.log.pageAbortedRequests =
  argv['log-page-aborted-requests'] || envBoolean('LOG_PAGE_ABORTED_REQUESTS') || config.log.pageAbortedRequests
config.log.pageFailedRequests =
  argv['log-page-failed-requests'] || envBoolean('LOG_PAGE_FAILED_REQUESTS') || config.log.pageFailedRequests
config.log.cache = argv['log-cache'] || envBoolean('LOG_CACHE') || config.log.cache

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
  argvStringList(argv['page-request-blacklist']) ||
  envStringList('PAGE_REQUEST_BLACKLIST') ||
  config.page.requestBlacklist

config.static.contentOutput =
  argv['static-content-output'] || envString('STATIC_CONTENT_OUTPUT') || config.static.contentOutput

config.urlRewrite = {
  ...(config.urlRewrite || {}),
  ...{
    pathifyParams:
      argv['url-rewrite-pathify-params'] || envBoolean('URL_REWRITE_PATHIFY_PARAMS') || config.urlRewrite.pathifyParams,
    regex:
      argvStringTupleList(argv['url-rewrite-regex']) ||
      envStringTupleList('URL_REWRITE_REGEX') ||
      config.urlRewrite.regex,
  },
}

config.rewrite = {
  ...(config.rewrite || {}),
  ...{
    cssSelectorRemove:
      argvStringList(argv['rewrite-css-selector-remove']) ||
      envStringList('REWRITE_CSS_SELECTOR_REMOVE') ||
      config.rewrite?.cssSelectorRemove,
    minify: argvJson(argv['rewrite-minify']) || envJson('REWRITE_MINIFY') || config.rewrite?.minify,
  },
}

config.static = {
  ...(config.static || {}),
  ...{
    dirIndex: argv['static-dir-index'] || envBoolean('STATIC_DIR_INDEX') || config.static?.dirIndex,
    nginx: {
      ...(config.static?.nginx || {}),
      ...{
        configFile:
          argv['static-nginx-config-file'] || envString('STATIC_NGINX_CONFIG_FILE') || config.static?.nginx?.configFile,
        serverName:
          argv['static-nginx-server-name'] || envString('STATIC_NGINX_SERVER_NAME') || config.static?.nginx?.serverName,
        notFoundPage:
          argv['static-not-found-page'] || envString('STATIC_NOT_FOUND_PAGE') || config.static?.nginx?.notFoundPage,
        errorPage: argv['static-error-page'] || envString('STATIC_ERROR_PAGE') || config.static?.nginx?.errorPage,
        errorCodes: argvNumberList(argv['static-error-codes']) ||
          envNumberList('STATIC_ERROR_CODES') ||
          config.static?.nginx?.errorCodes || [500, 502],
      },
    },
    s3: {
      ...(config.static?.s3 || {}),
      ...{
        uploadScript:
          argv['static-s3-upload-script'] || envString('STATIC_S3_UPLOAD_SCRIPT') || config.static?.s3?.uploadScript,
        bucketName:
          argv['static-s3-bucket-name'] || envString('STATIC_S3_BUCKET_NAME') || config.static?.s3?.bucketName,
        awsProfile:
          argv['static-s3-aws-profile'] || envString('STATIC_S3_AWS_PROFILE') || config.static?.s3?.awsProfile,
      },
    },
  },
}

if (config.static && Object.entries(config.static.nginx || {}).length === 0) {
  config.static.nginx = undefined
}
if (config.static && Object.entries(config.static.s3 || {}).length === 0) {
  config.static.s3 = undefined
}

export const envConfig: EnvConfig = {
  greenlock: envBoolean('GREENLOCK'),
  greenlockMaintainer: envString('GREENLOCK_MAINTAINER'),
  hostname: os.hostname(),
}

config.origins.push(`http://${envConfig.hostname}:${config.httpPort}`)

console.log(JSON.stringify(config, null, 4))
console.log('env config', JSON.stringify(envConfig, null, 4))

export const runtimeConfig: RuntimeConfig = {
  cacheEverything: false,
}

export default config
