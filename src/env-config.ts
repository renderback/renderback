export const envString = (name: string): string | undefined => process.env[name]

export const envStringList = (name: string): string[] | undefined => {
  const str = envString(name)
  return str && str.split(' ')
}

export const envNumberList = (name: string): number[] | undefined => {
  const strList = envStringList(name)
  return strList && strList.map((s) => Number(s))
}

export const envBoolean = (name: string): boolean | undefined => envString(name) && envString(name) === '1'

export const envNumber = (name: string): number | undefined => envString(name) && Number(envString(name))
