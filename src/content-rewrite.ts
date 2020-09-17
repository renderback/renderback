import { red } from 'chalk'

export const regexReplaceAll = (content: string, replacements: [string, string][]): string => {
  let workingCopy = content
  console.log(`[content-rewrite] applying ${replacements.length} replacements`)
  for (const [regex, replacement] of replacements) {
    if (workingCopy.toString().match(new RegExp(regex, 'gm'))) {
      workingCopy = workingCopy.toString().replace(new RegExp(regex, 'gm'), replacement)
    } else {
      console.log(`[content-rewrite] ${red('no matches')}: ${regex}`)
    }
  }
  return workingCopy
}
