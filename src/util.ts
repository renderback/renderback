import path from 'path'
import fs from 'fs'
import { Route } from './config'

export const modifyUrl = (modifyScript: string, url: string): string => {
  // eslint-disable-next-line no-eval
  const modifyFunction = eval(modifyScript)
  return modifyFunction(url)
}

export const buildMatcher = (route: Route): (string | RegExp)[] => {
  const paths = route.path ? route.path : []
  const regexes = route.regex ? route.regex.map((p) => new RegExp(p)) : []
  const extensions = route.ext ? [new RegExp(`^.+\\.(${route.ext.join('|')})$`)] : []

  return [...paths, ...regexes, ...extensions]
}

export const matcherToNginx = (matcher: string | RegExp): string => {
  if (typeof matcher === 'string') {
    if (matcher === '/') {
      return `location ~ /.+`
    }
    return `location ~ ${matcher}/.+`
  }
  const regex = `${matcher}`.slice(1, -1)
  return `location ~ ${regex}`
}

export const paramsToPathSuffix = (url: URL): string | undefined => {
  const { searchParams } = url
  const searchEntries = Array.from(searchParams.entries())
  if (searchEntries.length === 0) {
    return undefined
  }
  searchEntries.sort((a1, a2) => {
    if (a1[0] === a2[0]) {
      return 0
    }
    if (a1[0] < a2[0]) {
      return -1
    }
    return 1
  })
  return `/${searchEntries
    .map((searchEntry) => `${encodeURIComponent(searchEntry[0])}/${encodeURIComponent(searchEntry[1])}`)
    .join('/')}`
}

export const getFileName = ({
  outputDir,
  urlString,
  pathifyParams,
  urlRewrite,
  fileNameSuffix,
}: {
  outputDir: string
  urlString: string
  pathifyParams: boolean
  urlRewrite: [string, string][]
  fileNameSuffix?: string
}): string => {
  let workingUrl = urlString
  for (const [regex, replace] of urlRewrite) {
    workingUrl = workingUrl.replace(new RegExp(regex, 'g'), replace)
  }
  const url = new URL(workingUrl)
  const { pathname, searchParams } = url
  const rawDirName = path.dirname(pathname)
  const dirName = rawDirName.endsWith('/') ? rawDirName : `${rawDirName}/`
  const baseName = path.basename(pathname)
  const fileNameWithoutSearchParams = baseName === '' ? 'index' : baseName

  const searchEntries = Array.from(searchParams.entries())
  const paramsPathified = paramsToPathSuffix(url)
  let searchParamsEncoded: string
  if (paramsPathified && pathifyParams) {
    searchParamsEncoded = paramsPathified
  } else if (searchEntries.length > 0) {
    searchParamsEncoded = `-${Buffer.from(searchParams.toString()).toString('base64')}`
  }

  const fileName = searchParamsEncoded
    ? `${fileNameWithoutSearchParams}${searchParamsEncoded}`
    : fileNameWithoutSearchParams

  const fullDirName = searchParamsEncoded
    ? `${outputDir}${dirName}/${path.dirname(`${fileNameWithoutSearchParams}${searchParamsEncoded}`)}`
    : `${outputDir}${dirName}`
  if (!fs.existsSync(fullDirName)) {
    fs.mkdirSync(fullDirName, { recursive: true })
  }
  return `${dirName}${fileName}${fileNameSuffix || ''}`
}

export const snooze = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
