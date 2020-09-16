import fs from 'fs'
import prettyBytes from 'pretty-bytes'
import { cyan, green, red, yellow } from 'chalk'
import { minify } from 'html-minifier'
import preRender from './pre-render'
import config, { Route, runtimeConfig } from './config'
import cache from './cache'
import { getFileName } from './util'
import { copyDirRecursiveSync } from './copy-dir'
import { buildNginxConfig } from './nginx-config-builder'
import { buildS3UploadScript } from './s3-upload-script-builder'

const outputFile = (outputDir: string, fileName: string, content: Buffer): void => {
  console.log(`[static-site] writing file -> ${outputDir}${yellow(fileName)} (${cyan(prettyBytes(content.length))})`)
  fs.writeFileSync(`${outputDir}${fileName}`, content)
}

const staticSite = async (): Promise<void> => {
  const { static: staticSiteConfig } = config
  if (!staticSiteConfig.contentOutput) {
    console.error(red('content output dir is not configured'))
    process.exit(1)
  }
  console.log(green(`[static-site] generating static site into ${staticSiteConfig.contentOutput}...`))

  config.preRender = {
    ...(config.preRender || {}),
    ...{ enabled: true },
  }

  runtimeConfig.cacheEverything = true
  if (config.routes.some((route) => route.type === 'asset-proxy')) {
    config.page.abortResourceRequests = false
  }
  console.log(`[static-site] pre-rendering...`)
  await preRender()

  const processRoute = async (route: Route) => {
    switch (route.type) {
      case 'asset':
        console.log(`[static-site] copying assets: ${yellow(route.dir)} -> ${yellow(staticSiteConfig.contentOutput)}`)
        copyDirRecursiveSync(route.dir, staticSiteConfig.contentOutput)
        break

      default:
        break
    }
  }

  for (const route of config.routes) {
    // eslint-disable-next-line no-await-in-loop
    await processRoute(route)
  }

  console.log(yellow('[static-site] writing page files...'))
  const pageEntries = cache.listEntries()
  for (const [urlStr, entry] of pageEntries) {
    console.log(`[static-site] entry: ${urlStr} ${entry.status} ${entry.location || ''}`)

    const { status } = entry
    if (!(status >= 301 && status <= 303)) {
      const fileName = getFileName(
        staticSiteConfig.contentOutput,
        urlStr,
        staticSiteConfig.pathifySingleParams,
        '.html'
      )
      let { content } = entry
      if (staticSiteConfig.pageReplace) {
        console.log(`[static-site] applying ${staticSiteConfig.pageReplace.length} replacements`)
        staticSiteConfig.pageReplace.forEach(([regex, replacement]) => {
          if (content.toString().match(new RegExp(regex))) {
            content = Buffer.from(content.toString().replace(new RegExp(regex), replacement))
          } else {
            console.log(`[static-site] ${red('no matches')}: ${regex}`)
          }
        })
      }
      content = Buffer.from(minify(content.toString(), staticSiteConfig.minify))
      if (staticSiteConfig.pageReplaceAfterMinimize) {
        console.log(
          `[static-site] applying ${staticSiteConfig.pageReplaceAfterMinimize.length} replacements (after html-minimize)`
        )
        staticSiteConfig.pageReplaceAfterMinimize.forEach(([regex, replacement]) => {
          if (content.toString().match(new RegExp(regex))) {
            content = Buffer.from(content.toString().replace(new RegExp(regex), replacement))
          } else {
            console.log(`[static-site] ${red('no matches')}: ${regex}`)
          }
        })
      }
      outputFile(staticSiteConfig.contentOutput, fileName, content)
    }
  }

  console.log(yellow('[static-site] writing asset files...'))
  const assetEntries = cache.listAssetEntries()
  for (const [urlStr, entry] of assetEntries) {
    if (!(entry.status >= 301 && entry.status <= 303)) {
      const fileName = getFileName(staticSiteConfig.contentOutput, urlStr, false)
      try {
        outputFile(staticSiteConfig.contentOutput, fileName, entry.content)
      } catch (e) {
        console.error(red(`[static-site] failed to write asset file for ${urlStr} ${entry.status}: ${e.message}`))
      }
    }
  }

  if (staticSiteConfig.nginx) {
    const nginxConfig = buildNginxConfig({
      contentRoot: staticSiteConfig.contentOutput,
      pathifySingleParams: staticSiteConfig.pathifySingleParams,
      ...staticSiteConfig.nginx,
    })
    console.log(`[static-site] writing nginx config into ${yellow(staticSiteConfig.nginx.configFile)}`)
    fs.writeFileSync(staticSiteConfig.nginx.configFile, nginxConfig)
  }
  if (staticSiteConfig.s3) {
    const s3UploadScript = buildS3UploadScript({
      contentRoot: staticSiteConfig.contentOutput,
      pathifySingleParams: staticSiteConfig.pathifySingleParams,
      ...staticSiteConfig.s3,
    })
    console.log(`[static-site] writing s3 upload script into ${yellow(staticSiteConfig.s3.uploadScript)}`)
    fs.writeFileSync(staticSiteConfig.s3.uploadScript, s3UploadScript)
  }
}

export default staticSite