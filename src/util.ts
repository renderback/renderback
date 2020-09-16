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

export const singleParamPathSuffix = (url: URL): string | undefined => {
  const { searchParams } = url
  const searchEntries = Array.from(searchParams.entries())
  if (searchEntries.length === 1) {
    return `/${encodeURIComponent(searchEntries[0][0])}/${encodeURIComponent(searchEntries[0][1])}`
  }
  return undefined
}

export const getFileName = (
  outputDir: string,
  urlString: string,
  pathifySingleParams: boolean,
  fileNameSuffix?: string
): string => {
  const url = new URL(urlString)
  const { pathname, searchParams } = url
  const rawDirName = path.dirname(pathname)
  const dirName = rawDirName.endsWith('/') ? rawDirName : `${rawDirName}/`
  const baseName = path.basename(pathname)
  const fileNameWithoutSearchParams = baseName === '' ? 'index' : baseName

  const searchEntries = Array.from(searchParams.entries())
  const singleParamPathified = singleParamPathSuffix(url)
  let searchParamsEncoded: string
  if (singleParamPathified && pathifySingleParams) {
    searchParamsEncoded = singleParamPathified
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
