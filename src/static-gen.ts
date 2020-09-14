import fs from 'fs'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { cyan, green, blue, yellow, red } from 'chalk'
import preRender from './pre-render'
import config, { envConfig, ProxyRoute, Route, runtimeConfig } from './config'
import cache from './cache'
import { buildMatcher } from './util'
import { copyDirRecursiveSync } from './copy-dir'

const { static: staticGenConfig, preRender: preRenderEnabled } = config

const getFileName = (outputDir: string, urlString: string, fileNameSuffix?: string): string => {
  const url = new URL(urlString)
  const { pathname, searchParams } = url
  const rawDirName = path.dirname(pathname)
  const dirName = rawDirName.endsWith('/') ? rawDirName : `${rawDirName}/`
  const baseName = path.basename(pathname)
  const fileNameWithoutSearchParams = baseName === '' ? 'index' : baseName

  const searchParamsEncoded =
    searchParams.toString().length > 0 && Buffer.from(searchParams.toString()).toString('base64')

  const fileName = searchParamsEncoded
    ? `${fileNameWithoutSearchParams}-${searchParamsEncoded}`
    : fileNameWithoutSearchParams

  const fullDirName = `${outputDir}${dirName}`
  if (!fs.existsSync(fullDirName)) {
    fs.mkdirSync(fullDirName, { recursive: true })
  }
  return `${dirName}${fileName}${fileNameSuffix || ''}`
}

const outputFile = (outputDir: string, fileName: string, content: Buffer): void => {
  console.log(`[static-site] writing file -> ${outputDir}${yellow(fileName)} (${cyan(prettyBytes(content.length))})`)
  fs.writeFileSync(`${outputDir}${fileName}`, content)
}

const matcherToNginx = (matcher: string | RegExp): string => {
  if (typeof matcher === 'string') {
    if (matcher === '/') {
      return `location ~ /.+`
    }
    return `location ~ ${matcher}/.+`
  }
  const regex = `${matcher}`.slice(1, -1)
  return `location ~ ${regex}`
}

const staticGen = async (): Promise<void> => {
  runtimeConfig.cacheEverything = true
  if (config.routes.some((route) => route.type === 'asset-proxy')) {
    config.page.abortResourceRequests = false
  }
  if (!preRenderEnabled) {
    console.error(red('[static-site] pre-render is not enabled'))
    process.exit(1)
  }
  if (!staticGenConfig.contentOutput) {
    console.error(red('content output dir is not configured'))
    process.exit(1)
  }
  console.log(green(`[static-site] generating static site into ${staticGenConfig.contentOutput}...`))
  console.log(`[static-site] pre-rendering...`)
  await preRender()

  const entries = cache.listEntries()

  const processRoute = async (route: Route) => {
    switch (route.type) {
      case 'asset':
        console.log(`[static-site] copying assets: ${yellow(route.dir)} -> ${yellow(staticGenConfig.contentOutput)}`)
        copyDirRecursiveSync(route.dir, staticGenConfig.contentOutput)
        break

      default:
        break
    }
  }

  const processRoutes = async () => {
    for (const route of config.routes) {
      // eslint-disable-next-line no-await-in-loop
      await processRoute(route)
    }
  }

  await processRoutes()

  let nginxConfig = ''
  let indentation = ''

  const appendConfig = (str: string) => {
    nginxConfig += `${indentation}${str}\n`
  }

  const appendBlock = (prefix: string, suffix: string, fn: () => void) => {
    appendConfig(prefix)
    indentation += '    '
    fn()
    indentation = indentation.slice(0, -4)
    appendConfig(suffix)
    nginxConfig += '\n'
  }

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

  const writeExtraConfig = (extraConfig: any): void => {
    if (typeof extraConfig === 'string') {
      appendConfig(extraConfig)
    } else if (typeof extraConfig === 'object') {
      if (Array.isArray(extraConfig)) {
        for (const [, value] of Object.entries(extraConfig)) {
          writeExtraConfig(value)
        }
      } else {
        for (const [key, value] of Object.entries(extraConfig)) {
          appendBlock(`${key} {`, '}', () => {
            writeExtraConfig(value)
          })
        }
      }
    }
  }

  proxyRoutes.forEach((proxyRoute) => {
    appendBlock(`upstream ${proxyRoute.upstream} {`, '}', () => {
      appendConfig(`server ${proxyRoute.url.hostname}${proxyRoute.url.port ? `:${proxyRoute.url.port}` : ''};`)
    })
  })

  appendBlock('server {', '}', () => {
    if (staticGenConfig.nginxServerName) {
      appendConfig(`server_name "${staticGenConfig.nginxServerName}";\n`)
    }

    if (staticGenConfig.nginxExtraConfig) {
      writeExtraConfig(staticGenConfig.nginxExtraConfig)
    }

    appendConfig(`root ${staticGenConfig.contentOutput};\n`)

    proxyRoutes.forEach((proxyRoute) => {
      const matchers = buildMatcher(proxyRoute)
      matchers.forEach((matcher) => {
        appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
          appendConfig(`proxy_pass ${proxyRoute.url.protocol}//${proxyRoute.upstream};`)
        })
      })
    })

    config.routes.forEach(async (route) => {
      const matchers = buildMatcher(route)
      switch (route.type) {
        case 'asset':
        case 'asset-proxy':
          matchers.forEach((matcher) => {
            appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
              if (route.nginxExtraConfig) {
                writeExtraConfig(route.nginxExtraConfig)
              }
              if (route.nginxExpires) {
                appendConfig(`expires ${route.nginxExpires};`)
              }
              if (route.nginxCacheControlPublic) {
                appendConfig('add_header Cache-Control "public";')
              }
              appendConfig('try_files $uri =404;')
            })
          })
          break
        default:
          break
      }
    })

    for (const [urlStr, entry] of entries) {
      const fileName = getFileName(staticGenConfig.contentOutput, urlStr, '.html')
      let { content } = entry
      if (staticGenConfig.pageReplace) {
        console.log(`[static-site] applying ${staticGenConfig.pageReplace.length} replacements`)
        staticGenConfig.pageReplace.forEach(([regex, replacement]) => {
          if (content.toString().match(new RegExp(regex))) {
            content = Buffer.from(content.toString().replace(new RegExp(regex), replacement))
          } else {
            console.log(red(`[static-site] no matches: ${regex}`))
          }
        })
      }
      outputFile(staticGenConfig.contentOutput, fileName, content)
      const url = new URL(urlStr)
      const { pathname, searchParams } = url
      if (searchParams.toString().length > 0) {
        console.warn('[static-site] cannot route URLs with search query in nginx config', urlStr)
      } else {
        appendBlock(`location ${pathname} {`, '}', () => {
          appendConfig('try_files $uri.html =404;')
        })
      }
    }

    if (staticGenConfig.notFoundPage) {
      const notFoundPage = cache.get(`http://${envConfig.hostname}:${config.httpPort}${staticGenConfig.notFoundPage}`)
      if (!notFoundPage) {
        console.warn(
          red(
            `not configuring a Not Found page: ${staticGenConfig.notFoundPage} was not rendered (is it listed in pre-render?)`
          )
        )
      } else {
        appendConfig(`error_page 404 ${staticGenConfig.notFoundPage};`)
      }
    }

    if (staticGenConfig.errorPage) {
      const errorPage = cache.get(`http://${envConfig.hostname}:${config.httpPort}${staticGenConfig.errorPage}`)
      if (!errorPage) {
        console.warn(
          red(
            `not configuring an error page: ${staticGenConfig.errorPage} was not rendered (is it listed in pre-render?)`
          )
        )
      } else {
        staticGenConfig.errorCodes.forEach((errorCode) => {
          appendConfig(`error_page ${errorCode} ${staticGenConfig.errorPage};`)
        })
      }
    }

    const assetEntries = cache.listAssetEntries()
    for (const [urlStr, entry] of assetEntries) {
      const fileName = getFileName(staticGenConfig.contentOutput, urlStr)
      outputFile(staticGenConfig.contentOutput, fileName, entry.content)
    }
  })

  if (staticGenConfig.nginxConfigFile) {
    console.log(`[static-site] writing nginx config into ${yellow(staticGenConfig.nginxConfigFile)}`)
    fs.writeFileSync(staticGenConfig.nginxConfigFile, nginxConfig)
  } else {
    console.log('[static-site] nginx config:\n')
    console.log(blue(nginxConfig))
  }
}

export default staticGen
