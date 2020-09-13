import fs from 'fs'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import preRender from './pre-render'
import config, { runtimeConfig } from './config'
import cache, { CacheEntry } from './cache'

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
  const fullDirName = `${outputDir}/${hostname}${dirName}`
  if (!fs.existsSync(fullDirName)) {
    fs.mkdirSync(fullDirName, { recursive: true })
  }
  const fullFileName = `${fullDirName}${fileName}${fileNameSuffix || ''}`
  console.log('writing file:', fullFileName, prettyBytes(entry.content.length))
  fs.writeFileSync(fullFileName, entry.content)
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
}

export default staticGen
