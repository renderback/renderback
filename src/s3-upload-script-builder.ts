import { red, yellow } from 'chalk'
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
    recursive,
  }: {
    source: string
    target: string
    contentType?: string
    acl?: string
    recursive?: boolean
  }): void {
    this.append(
      `aws --profile=${this.profile} s3 cp ${source} s3://${this.bucket}${target} ${
        contentType ? `--content-type "${contentType}"` : ''
      } ${acl ? `--acl ${acl}` : ''} ${recursive ? '--recursive' : ''}`
    )
  }
}

const uploadDirRecursiveScript = (uploadScript: S3UploadScriptBuilder, root: string, source: string): void => {
  uploadScript.cp({
    source,
    target: '/',
    recursive: true,
    acl: 'public-read',
  })
}

export const buildS3UploadScript = ({
  contentRoot,
  bucketName,
  awsProfile,
  pathifyParams,
}: {
  contentRoot: string
  pathifyParams: boolean
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
      const fileName = getFileName(contentRoot, urlStr, pathifyParams)
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
      const fileName = getFileName(contentRoot, urlStr, pathifyParams)
      uploadScript.cp({
        source: `${contentRoot}${fileName}`,
        target: fileName,
        contentType: mime.lookup(urlStr) || 'application/octet-stream',
        acl: 'public-read',
      })
    }
  }

  for (const route of config.routes) {
    switch (route.type) {
      case 'asset':
        console.log(`[s3] upload assets: ${yellow(route.dir)}`)
        uploadDirRecursiveScript(uploadScript, route.dir, route.dir)
        break

      default:
        break
    }
  }

  return uploadScript.toString()
}
