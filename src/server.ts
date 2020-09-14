import greenlock from 'greenlock-express'
import { Server } from 'http'
import app from './app'
import config, { argv, envConfig } from './config'
import preRender from './pre-render'
import staticGen from './static-gen'

const startHttpServer = (callback: (server: Server) => void) => {
  console.log(`starting http server...`)
  const server = app.listen(config.httpPort, '0.0.0.0', () => callback(server))
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
      console.log(`starting express http server...`)
      startHttpServer(() => {
        console.log(`server started at http://${envConfig.hostname}:${config.httpPort}`)
      })
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
    startHttpServer(async (server) => {
      console.log(`server started at http://${envConfig.hostname}:${config.httpPort}`)
      await staticGen()
      server.close()
      process.exit(0)
    })
    break
  default:
    console.log(`unrecognized command: ${command}`)
}

export default {}
