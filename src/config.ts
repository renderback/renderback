import fs from 'fs'

export interface Config {
  browserExecutablePath: string
  greenlock?: boolean
  port: number
  userAgent: string
  cacheResponses: boolean
  prerender: boolean
  adminAccessKey: string
  pageConfig: PageConfig
  prerenderPaths: string[]
  rules: RoutingRule[]
}

export interface PageConfig {
  waitSelector: string
  resetSelectorScript: string
  navigateScript: string
  logErrors: boolean
  logConsole: boolean
  logResponses: boolean
  logFailedRequests: boolean
  abortResourceRequests: boolean
  requestBlacklist: string[]
}

export interface ProxyRoutingRule {
  rule: 'proxy'
  ext?: string[]
  path?: string[]
  regex?: string[]
  target: string
}

export interface StaticAssetRoutingRule {
  rule: 'asset'
  ext?: string[]
  path?: string[]
  regex?: string[]
  dir: string
  maxAge?: number // default 31557600000
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
  | PageRoutingRule
  | PageProxyRoutingRule
  | NotFoundRoutingRule

const config: Config = JSON.parse(fs.readFileSync('config.json', 'utf8'))

console.log('config', JSON.stringify(config, null, 4))

export default config
