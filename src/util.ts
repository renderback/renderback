import { RoutingRule } from './config'

export const modifyUrl = (modifyScript: string, url: string): string => {
  // eslint-disable-next-line no-eval
  const modifyFunction = eval(modifyScript)
  return modifyFunction(url)
}

export const buildMatcher = (rule: RoutingRule): (string | RegExp)[] => {
  const paths = rule.path ? rule.path : []
  const regexes = rule.regex ? rule.regex.map((p) => new RegExp(p)) : []
  const extensions = rule.ext ? [new RegExp(`^.+\\.(${rule.ext.join('|')})$`)] : []

  return [...paths, ...regexes, ...extensions]
}
