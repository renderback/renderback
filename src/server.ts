import greenlock from 'greenlock-express'
import { Server } from 'http'
import { yellow } from 'chalk'
import app from './app'
import config, { argv, envConfig } from './config'
import preRender from './pre-render'
import staticSite from './static-site'

const startHttpServer = (callback?: (server: Server) => void) => {
  const server = app.listen(config.httpPort, '0.0.0.0', () => {
    console.log(yellow(`server started at http://${envConfig.hostname}:${config.httpPort}`))
    if (callback) {
      callback(server)
    }
  })
  return server
}

const command = argv._[0]
switch (command) {
  case 'start':
    if (envConfig.greenlock) {
      console.log(`starting greenlock http server...`)
      if (!envConfig.greenlockMaintainer) {
        console.log(`greenlock maintainer is missing, disabling greenlock`)
        process.exit(1)
      }
      console.log(`greenlock maintainer: ${envConfig.greenlockMaintainer}`)
      greenlock
        .init({
          packageRoot: __dirname,
          maintainerEmail: envConfig.greenlockMaintainer,
          configDir: './greenlock.d',
          cluster: false,
        })
        .serve(app)
    } else {
      startHttpServer()
    }
    if (config.preRender) {
      console.log(`pre-rendering the pages...`)
      preRender()
        .then(() => {
          console.log('pre-render finished')
        })
        .catch((e) => console.error('pre-render failed', e))
    }
    break
  case 'static-site':
    // eslint-disable-next-line no-case-declarations
    const server = startHttpServer()
    staticSite()
      .then(() => {
        console.info('static site finished')
        server.close()
        process.exit(0)
      })
      .catch((e) => {
        console.error('static site failed', e)
        server.close()
        process.exit(1)
      })
    break
  default:
    console.log(`unrecognized command: ${command}`)
}

export default {}
