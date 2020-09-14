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
