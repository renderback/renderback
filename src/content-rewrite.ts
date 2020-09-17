import { red } from 'chalk'

export const regexReplaceAll = (content: string, replacements: [string, string][]): string => {
  let workingCopy = content
  console.log(`[content-rewrite] applying ${replacements.length} replacements`)
  for (const [regex, replacement] of replacements) {
    if (content.toString().match(new RegExp(regex))) {
      workingCopy = content.toString().replace(new RegExp(regex), replacement)
    } else {
      console.log(`[content-rewrite] ${red('no matches')}: ${regex}`)
    }
  }
  return workingCopy
}
