import fs from 'fs'
import os from 'os'
import yargs, { Argv } from 'yargs'

export interface Config {
  browserExecutablePath: string
  port: number
  userAgent: string
  cacheResponses: boolean
  adminAccessKey: string
  pageConfig: PageConfig
  rules: RoutingRule[]
  preRender?: PreRenderConfig
  log: LogConfig
}

export interface PreRenderConfig {
  paths: string[]
}

export interface PageConfig {
  waitSelector: string
  resetSelectorScript: string
  navigateScript: string
  abortResourceRequests: boolean
  requestBlacklist: string[]
}

export interface LogConfig {
  headless?: boolean
  requestsFromHeadless?: boolean
  cache?: boolean
  ruleMatch?: number // 0 -- disable
  preCompressedAssets?: boolean
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
  useGreenlock: boolean
  greenlockMaintainer?: string
  shouldPreRender: boolean
  preRenderStartUrl?: string
  hostname: string
}

const typedYargs: Argv<{ config?: string }> = yargs
const configFile = typedYargs.argv.config || 'config.json'
console.log(`args`, yargs.argv)
console.log(`reading config: ${configFile}`)
const config: Config = JSON.parse(fs.readFileSync(configFile, 'utf8'))

export const envConfig: EnvConfig = {
  useGreenlock: process.env.GREENLOCK === '1',
  greenlockMaintainer: process.env.GREENLOCK_MAINTAINER,
  shouldPreRender: process.env.PRERENDER === '1',
  preRenderStartUrl: process.env.PRERENDER_START_URL,
  hostname: os.hostname(),
}

console.log(JSON.stringify(config, null, 4))
console.log('env config', JSON.stringify(envConfig, null, 4))

export default config
