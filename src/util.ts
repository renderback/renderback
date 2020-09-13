export const modifyUrl = (modifyScript: string, url: string): string => {
  // eslint-disable-next-line no-eval
  const modifyFunction = eval(modifyScript)
  return modifyFunction(url)
}
