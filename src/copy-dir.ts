import fs from 'fs'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { cyan } from 'chalk'

export const copyFileSync = (source: string, target: string): void => {
  let targetFile = target

  // if target is a directory a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source))
    }
  }

  console.log(`[static-site] writing -> ${targetFile} (${cyan(prettyBytes(fs.statSync(source).size))}) (copy assets)`)
  fs.copyFileSync(source, targetFile)
}

export const copyDirRecursiveSync = (source: string, target: string): void => {
  let files = []

  // check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder)
  }

  // copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source)
    files.forEach((file) => {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyDirRecursiveSync(curSource, targetFolder)
      } else {
        copyFileSync(curSource, targetFolder)
      }
    })
  }
}
