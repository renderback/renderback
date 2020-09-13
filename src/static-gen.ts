import fs from 'fs'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import preRender from './pre-render'
import config, { runtimeConfig } from './config'
import cache, { CacheEntry } from './cache'
import { buildMatcher } from './util'

const { /* static: staticGenConfig, */ preRender: preRenderConfig } = config

const outputFile = (
  outputDir: string,
  urlString: string,
  entry: CacheEntry,
  fileNameSuffix?: string
): void => {
  const url = new URL(urlString)
  const { hostname, pathname, searchParams } = url
  const rawDirName = path.dirname(pathname)
  const dirName = rawDirName.endsWith('/') ? rawDirName : `${rawDirName}/`
  const baseName = path.basename(pathname)
  const fileNameWithoutSearchParams = baseName === '' ? 'index' : baseName

  const searchParamsEncoded =
    searchParams && Buffer.from(searchParams.toString()).toString('base64')

  const fileName = searchParamsEncoded
    ? `${fileNameWithoutSearchParams}-${searchParamsEncoded}`
    : fileNameWithoutSearchParams
  // const fullDirName = `${outputDir}/${hostname}${dirName}`
  const fullDirName = `${outputDir}${dirName}`
  if (!fs.existsSync(fullDirName)) {
    fs.mkdirSync(fullDirName, { recursive: true })
  }
  const fullFileName = `${fullDirName}${fileName}${fileNameSuffix || ''}`
  console.log('writing file:', fullFileName, prettyBytes(entry.content.length))
  fs.writeFileSync(fullFileName, entry.content)
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

const staticGen = async (output: string, nginxFile: string): Promise<void> => {
  runtimeConfig.cacheEverything = true
  config.page.abortResourceRequests = false
  if (!preRenderConfig) {
    console.error('pre-render is not configured')
    return
  }
  // if (!staticGenConfig) {
  //   console.error('static site generation is not configured')
  //   return
  // }
  await preRender()

  const entries = cache.listEntries()
  // eslint-disable-next-line no-restricted-syntax
  for (const [url, entry] of entries) {
    console.log('entry', url)
    outputFile(output, url, entry, '.html')
  }
  const assetEntries = cache.listAssetEntries()
  // eslint-disable-next-line no-restricted-syntax
  for (const [url, entry] of assetEntries) {
    console.log('entry', url)
    outputFile(output, url, entry)
  }

  console.log('server {')
  console.log(`  root ${output};`)
  console.log(`  location / {`)
  console.log('    index index.html;')
  console.log(`  }`)

  config.rules.forEach((rule) => {
    // console.log('rule', JSON.stringify(rule))

    const matchers = buildMatcher(rule)
    // console.log('matchers', matchers)

    // console.log('upstream saa-fe-ssr {')
    //
    //      server 127.0.0.1:8080;
    // }
    //    location ~ ^/lessons/lesson-picture/.* {
    //         proxy_pass https://saa-static.s3.amazonaws.com;
    //     }

    switch (rule.rule) {
      case 'page':
      case 'page-proxy':
        matchers.forEach((matcher) => {
          console.log(`  ${matcherToNginx(matcher)} {`)
          console.log('    try_files $uri $uri.html =404;')
          console.log(`  }`)
        })
        break

      case 'asset':
      case 'asset-proxy':
        matchers.forEach((matcher) => {
          console.log(`  ${matcherToNginx(matcher)} {`)
          console.log('    try_files $uri =404;')
          console.log(`  }`)
        })
        break
      case 'proxy':
        break
      default:
        break
    }
  })

  console.log('}')
}

export default staticGen
