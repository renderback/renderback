import { red } from 'chalk'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import config, { ProxyRoute, StaticSiteS3Config } from './config'
import cache from './cache'
import { getFileName } from './util'

export class S3UploadScriptBuilder {
  private _str: string

  private readonly profile: string

  private readonly bucket: string

  constructor(profile: string, bucket: string) {
    this._str = ''
    this.profile = profile
    this.bucket = bucket
  }

  toString(): string {
    return this._str
  }

  append(str: string): void {
    this._str += `${str}\n`
  }

  cp({
    source,
    target,
    contentType,
    acl,
  }: {
    source: string
    target: string
    contentType?: string
    acl?: string
  }): void {
    this.append(
      `aws --profile=${this.profile} s3 cp ${source} s3://${this.bucket}${target} ${
        contentType && `--content-type "${contentType}" ${acl && `--acl ${acl}`}`
      } `
    )
  }
}

export const buildS3UploadScript = ({
  contentRoot,
  bucketName,
  awsProfile,
  pathifySingleParams,
}: {
  contentRoot: string
  pathifySingleParams: boolean
} & StaticSiteS3Config): string => {
  const uploadScript = new S3UploadScriptBuilder(awsProfile, bucketName)

  config.routes
    .filter((route) => route.type === 'proxy')
    .forEach((proxyRoute: ProxyRoute) => {
      console.log(red(`[s3] proxy routes are not supported in S3 static sites: ${JSON.stringify(proxyRoute)}`))
    })

  uploadScript.append('#!/usr/bin/env bash\n')

  const entries = cache.listEntries()
  for (const [urlStr, entry] of entries) {
    console.log(`[s3] entry: ${urlStr} ${entry.status} ${entry.location || ''}`)

    const { status } = entry
    if (!(status >= 301 && status <= 303)) {
      const fileName = getFileName(contentRoot, urlStr, pathifySingleParams)
      uploadScript.cp({
        source: `${contentRoot}${fileName}.html`,
        target: fileName,
        contentType: 'text/html',
        acl: 'public-read',
      })
      uploadScript.cp({
        source: `${contentRoot}${fileName}.html`,
        target: `${fileName}.html`,
        contentType: 'text/html',
        acl: 'public-read',
      })
    }
  }

  const assetEntries = cache.listAssetEntries()
  for (const [urlStr, entry] of assetEntries) {
    if (!(entry.status >= 301 && entry.status <= 303)) {
      const fileName = getFileName(contentRoot, urlStr, pathifySingleParams)
      uploadScript.cp({
        source: `${contentRoot}${fileName}`,
        target: fileName,
        contentType: mime.lookup(urlStr) || 'application/octet-stream',
        acl: 'public-read',
      })
    }
  }

  return uploadScript.toString()
}

export const uploadFileScript = (
  uploadScript: S3UploadScriptBuilder,
  contentRoot: string,
  source: string,
  target: string
): void => {
  let targetFile = target

  // if target is a directory a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source))
    }
  }

  uploadScript.cp({
    source: source.replace(contentRoot, ''),
    target: targetFile.replace(contentRoot, ''),
    contentType: mime.lookup(source) || 'application/octet-stream',
    acl: 'public-read',
  })
}

export const uploadDirRecursiveScript = (
  uploadScript: S3UploadScriptBuilder,
  contentRoot: string,
  source: string,
  target: string
): void => {
  let files = []

  // check if folder needs to be created or integrated
  const targetFolder = target
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder)
  }

  // copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source)
    files.forEach((file) => {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        uploadDirRecursiveScript(uploadScript, contentRoot, curSource, targetFolder)
      } else {
        uploadFileScript(uploadScript, contentRoot, curSource, targetFolder)
      }
    })
  }
}
