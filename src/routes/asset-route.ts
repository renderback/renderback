import express, { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'
import mime from 'mime-types'
import fs from 'fs'
import { AssetRoute } from '../config'

export const assetRoute = async (
  route: AssetRoute,
  dir: string,
  req: Request,
  resp: Response,
  next: NextFunction
): Promise<Response> => {
  req.url = req.originalUrl
  const contentType = mime.lookup(req.url) || 'application/octet-stream'

  if (req.acceptsEncodings().indexOf('br') >= 0 && fs.existsSync(`${dir}${req.url}.br`)) {
    req.url = `${req.url}.br`
    resp.set('Content-Encoding', 'br')
    resp.contentType(contentType)
  } else if (req.acceptsEncodings().indexOf('gzip') >= 0 && fs.existsSync(`${dir}${req.url}.gz`)) {
    req.url = `${req.url}.gz`
    resp.set('Content-Encoding', 'gzip')
    resp.contentType(contentType)
  }

  return express.static(dir, {
    maxAge: route.maxAge || 31557600000,
    fallthrough: false,
  })(req, resp, next)
}
