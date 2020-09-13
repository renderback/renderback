import fs from 'fs'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { ncp } from 'ncp'
import { promisify } from 'util'
import preRender from './pre-render'
import config, { ProxyRoutingRule, RoutingRule, runtimeConfig } from './config'
import cache from './cache'
import { buildMatcher } from './util'

const { static: staticGenConfig, preRender: preRenderConfig } = config

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
  console.log('writing file:', `${outputDir}${fileName}`, prettyBytes(content.length))
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

const staticGen = async (contentOutput?: string, nginxFile?: string, serverName?: string): Promise<void> => {
  runtimeConfig.cacheEverything = true
  config.page.abortResourceRequests = false
  if (!preRenderConfig) {
    console.error('pre-render is not configured')
    process.exit(1)
  }
  const output = contentOutput || staticGenConfig.contentOutput
  if (!output) {
    console.error('content output dir is not configured')
    process.exit(1)
  }
  await preRender()

  const entries = cache.listEntries()

  const processRule = async (rule: RoutingRule) => {
    switch (rule.rule) {
      case 'asset':
        console.log(`copying assets: ${rule.dir} -> ${output}`)
        await promisify(ncp)(rule.dir, output)
        console.log('done copying')
        break

      default:
        break
    }
  }

  const processRules = async () => {
    for (const rule of config.rules) {
      // eslint-disable-next-line no-await-in-loop
      await processRule(rule)
    }
  }

  await processRules()

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

  const proxyRules: (ProxyRoutingRule & {
    upstream: string
    url: URL
  })[] = config.rules
    .filter((rule) => rule.rule === 'proxy')
    .map((proxyRule: ProxyRoutingRule, index) => {
      return {
        upstream: `proxy-${index}`,
        url: new URL(proxyRule.target),
        ...proxyRule,
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

  proxyRules.forEach((proxyRule) => {
    appendBlock(`upstream ${proxyRule.upstream} {`, '}', () => {
      appendConfig(`server ${proxyRule.url.hostname}${proxyRule.url.port ? `:${proxyRule.url.port}` : ''};`)
    })
  })

  appendBlock('server {', '}', () => {
    if (serverName || staticGenConfig.nginxServerName) {
      appendConfig(`server_name "${serverName || staticGenConfig.nginxServerName}";\n`)
    }

    if (staticGenConfig.nginxExtraConfig) {
      writeExtraConfig(staticGenConfig.nginxExtraConfig)
    }

    appendConfig(`root ${output};\n`)

    proxyRules.forEach((proxyRule) => {
      const matchers = buildMatcher(proxyRule)
      matchers.forEach((matcher) => {
        appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
          appendConfig(`proxy_pass ${proxyRule.url.protocol}//${proxyRule.upstream};`)
        })
      })
    })

    config.rules.forEach(async (rule) => {
      const matchers = buildMatcher(rule)
      switch (rule.rule) {
        case 'asset':
        case 'asset-proxy':
          matchers.forEach((matcher) => {
            appendBlock(`${matcherToNginx(matcher)} {`, '}', () => {
              appendConfig('try_files $uri =404;')
            })
          })
          break
        default:
          break
      }
    })

    for (const [urlStr, entry] of entries) {
      const fileName = getFileName(output, urlStr, '.html')
      let { content } = entry
      if (staticGenConfig.pageCleanUp) {
        staticGenConfig.pageCleanUp.forEach(([regex, replacement]) => {
          content = Buffer.from(content.toString().replace(new RegExp(regex), replacement))
        })
      }
      outputFile(output, fileName, content)
      const url = new URL(urlStr)
      const { pathname, searchParams } = url
      if (searchParams.toString().length > 0) {
        console.warn('cannot route URLs with search query in nginx config', urlStr)
      } else {
        appendBlock(`location ${pathname} {`, '}', () => {
          appendConfig('try_files $uri.html =404;')
        })
      }
    }

    const assetEntries = cache.listAssetEntries()
    for (const [urlStr, entry] of assetEntries) {
      console.log('entry', urlStr)
      const fileName = getFileName(output, urlStr)
      outputFile(output, fileName, entry.content)
    }
  })

  const configFileOutput = nginxFile || staticGenConfig.nginxConfigOutputFile

  if (configFileOutput) {
    console.log('writing nginx config into', configFileOutput)
    fs.writeFileSync(configFileOutput, nginxConfig)
  } else {
    console.log('nginx config:')
    console.log(nginxConfig)
  }
}

export default staticGen
