const parseTupleList = (strings?: string[]): [string, string][] | undefined => {
  return (
    strings &&
    strings.map((str): [string, string] => {
      const split = str.split(/\s+/)
      if (split.length !== 2) {
        console.error(
          `[config] can not parse string tuple list: ${str} (must contain two parts separated by whitespace)`
        )
        process.exit(1)
        return ['', '']
      }
      return split as [string, string]
    })
  )
}

export const envString = (name: string): string | undefined => process.env[name]

export const envStringList = (name: string): string[] | undefined => {
  const str = envString(name)
  return str && str.split(' ')
}

export const envStringTupleList = (name: string): [string, string][] | undefined => parseTupleList(envStringList(name))

export const envNumberList = (name: string): number[] | undefined => {
  const strList = envStringList(name)
  return strList && strList.map((s) => Number(s))
}

export const envBoolean = (name: string): boolean | undefined => envString(name) && envString(name) === '1'

export const envNumber = (name: string): number | undefined => envString(name) && Number(envString(name))

export const envJson = (name: string): unknown | undefined => envString(name) && JSON.parse(envString(name))

export const argvStringList = (list?: (string | number)[]): string[] | undefined =>
  list ? list.map((s) => String(s)) : undefined

export const argvStringTupleList = (list?: (string | number)[]): [string, string][] | undefined =>
  parseTupleList(argvStringList(list))

export const argvNumberList = (list?: (string | number)[]): number[] | undefined =>
  list ? list.map((s) => Number(s)) : undefined

export const argvJson = (str?: string): unknown | undefined => str && JSON.parse(str)