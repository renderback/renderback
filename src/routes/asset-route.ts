import express, { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import mime from 'mime-types'
import fs from 'fs'
import config, { runtimeConfig, StaticAssetRoutingRule } from '../config'
import cache from '../cache'

export const assetRoute = async (
  rule: StaticAssetRoutingRule,
  dir: string,
  req: Request,
  resp: Response,
  next: NextFunction
): Promise<Response> => {
  req.url = req.originalUrl
  const contentType = mime.lookup(req.url) || 'application/octet-stream'

  if (
    req.acceptsEncodings().indexOf('br') >= 0 &&
    fs.existsSync(`${dir}${req.url}.br`)
  ) {
    if (config.log.precompressedAssets) {
      console.log(`  ${req.url} -> ${req.url}.br (${contentType})`)
    }
    req.url = `${req.url}.br`
    resp.set('Content-Encoding', 'br')
    resp.contentType(contentType)
  } else if (
    req.acceptsEncodings().indexOf('gzip') >= 0 &&
    fs.existsSync(`${dir}${req.url}.gz`)
  ) {
    if (config.log.precompressedAssets) {
      console.log(`  ${req.url} -> ${req.url}.gz (${contentType})`)
    }
    req.url = `${req.url}.gz`
    resp.set('Content-Encoding', 'gzip')
    resp.contentType(contentType)
  }

  if (runtimeConfig.cacheEverything) {
    cache.setAsset(
      `${req.protocol}://${req.hostname}${req.url}`,
      fs.readFileSync(`${dir}${req.url}`)
    )
  }

  return express.static(dir, {
    maxAge: rule.maxAge || 31557600000,
    fallthrough: false,
  })(req, resp, next)
}
