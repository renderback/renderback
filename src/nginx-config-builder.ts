import { red } from 'chalk'
import config, { envConfig, ProxyRoute, StaticSiteNginxConfig } from './config'
import cache from './cache'
import { buildMatcher, matcherToNginx } from './util'

export class NginxConfigBuilder {
  private _str: string

  private indentation = ''

  constructor() {
    this._str = ''
  }

  toString(): string {
    return this._str
  }

  appendConfig(str: string): void {
    this._str += `${this.indentation}${str}\n`
  }

  appendBlock(prefix: string, suffix: string, fn: () => void): void {
    this.appendConfig(prefix)
    this.indentation += '    '
    fn()
    this.indentation = this.indentation.slice(0, -4)
    this.appendConfig(suffix)
    this._str += '\n'
  }

  writeExtraConfig(extraConfig: unknown): void {
    if (typeof extraConfig === 'string') {
      this.appendConfig(extraConfig)
    } else if (typeof extraConfig === 'object') {
      if (Array.isArray(extraConfig)) {
        for (const [, value] of Object.entries(extraConfig)) {
          this.writeExtraConfig(value)
        }
      } else {
        for (const [key, value] of Object.entries(extraConfig)) {
          this.appendBlock(`${key} {`, '}', () => {
            this.writeExtraConfig(value)
          })
        }
      }
    }
  }
}

export const buildNginxConfig = ({
  contentRoot,
  serverName,
  notFoundPage,
  errorPage,
  errorCodes,
  extraConfig,
}: {
  contentRoot: string
} & StaticSiteNginxConfig): string => {
  const entries = cache.listEntries()
  const nginxConfig = new NginxConfigBuilder()

  const proxyRoutes: (ProxyRoute & {
    upstream: string
    url: URL
  })[] = config.routes
    .filter((route) => route.type === 'proxy')
    .map((proxyRoute: ProxyRoute, index) => {
      return {
        upstream: `proxy-${index}`,
        url: new URL(proxyRoute.target),
        ...proxyRoute,
      }
    })

  proxyRoutes.forEach((proxyRoute) => {
    nginxConfig.appendBlock(`upstream ${proxyRoute.upstream} {`, '}', () => {
      nginxConfig.appendConfig(
        `server ${proxyRoute.url.hostname}${proxyRoute.url.port ? `:${proxyRoute.url.port}` : ''};`
      )
    })
  })

  nginxConfig.appendBlock('server {', '}', () => {
    if (serverName) {
      nginxConfig.appendConfig(`server_name "${serverName}";\n`)
    }

    if (extraConfig) {
      nginxConfig.writeExtraConfig(extraConfig)
    }

    nginxConfig.appendConfig(`root ${contentRoot};\n`)

    proxyRoutes.forEach((proxyRoute) => {
      const matchers = buildMatcher(proxyRoute)
      matchers.forEach((matcher) => {
        nginxConfig.appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
          nginxConfig.appendConfig(`proxy_pass ${proxyRoute.url.protocol}//${proxyRoute.upstream};`)
        })
      })
    })

    config.routes.forEach(async (route) => {
      const matchers = buildMatcher(route)
      switch (route.type) {
        case 'page':
        case 'page-proxy':
          matchers.forEach((matcher) => {
            nginxConfig.appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
              if (route.nginxExtraConfig) {
                nginxConfig.writeExtraConfig(route.nginxExtraConfig)
              }
              nginxConfig.appendConfig('try_files $uri.html =404;')
            })
          })
          break
        case 'asset':
        case 'asset-proxy':
          matchers.forEach((matcher) => {
            nginxConfig.appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
              if (route.nginxExtraConfig) {
                nginxConfig.writeExtraConfig(route.nginxExtraConfig)
              }
              if (route.nginxExpires) {
                nginxConfig.appendConfig(`expires ${route.nginxExpires};`)
              }
              if (route.nginxCacheControlPublic) {
                nginxConfig.appendConfig('add_header Cache-Control "public";')
              }
              nginxConfig.appendConfig('try_files $uri =404;')
            })
          })
          break
        default:
          break
      }
    })

    for (const [urlStr, entry] of entries) {
      const url = new URL(urlStr)
      const { pathname, searchParams } = url
      if (searchParams.toString().length > 0) {
        if (!config.pathifyParams) {
          console.warn('[static-site] cannot route URLs with search query in nginx config', urlStr)
        }
      } else {
        const { status, location } = entry
        if (status >= 301 && status <= 303) {
          console.log(`[static-site] page redirect: ${pathname} ${status} location:${location}`)
          if (location) {
            nginxConfig.appendBlock(`location ${pathname} {`, '}', () => {
              nginxConfig.appendConfig(`return 301 ${location.pathname};`)
            })
          } else {
            console.warn(`[static-site] redirect without location: ${pathname}`)
          }
        }
      }
    }

    if (notFoundPage) {
      if (!cache.get(`http://${envConfig.hostname}:${config.httpPort}${notFoundPage}`)) {
        console.warn(
          red(`not configuring a Not Found page: ${notFoundPage} was not rendered (is it listed in pre-render?)`)
        )
      } else {
        nginxConfig.appendConfig(`error_page 404 ${notFoundPage};`)
      }
    }

    if (errorPage) {
      if (!cache.get(`http://${envConfig.hostname}:${config.httpPort}${errorPage}`)) {
        console.warn(red(`not configuring an error page: ${errorPage} was not rendered (is it listed in pre-render?)`))
      } else {
        errorCodes.forEach((errorCode) => {
          nginxConfig.appendConfig(`error_page ${errorCode} ${errorPage};`)
        })
      }
    }
  })

  return nginxConfig.toString()
}
