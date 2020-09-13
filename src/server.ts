import greenlock from 'greenlock-express'
import { Server } from 'http'
import app from './app'
import config, { argv, envConfig } from './config'
import preRender from './pre-render'
import staticGen from './static-gen'

const startHttpServer = (callback: (server: Server) => void) => {
  console.log(`starting http server...`)
  const server = app.listen(config.port, '0.0.0.0', () => callback(server))
}

const command = argv._[0]
switch (command) {
  case 'serve':
    startHttpServer(() => {
      console.log(
        `server started at http://${envConfig.hostname}:${config.port}`
      )
    })
    break
  case 'greenlock':
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
    break
  case 'pre-render':
    console.log(`pre-rendering the pages...`)
    preRender()
      .then(() => {
        console.log('pre-render finished')
      })
      .catch((e) => console.error('pre-render failed', e))
    break
  case 'static-gen':
    console.log(`generating the static site...`)
    // eslint-disable-next-line no-case-declarations
    const { output, 'nginx-file': nginxFile } = argv
    if (!output) {
      console.error(`output is not specified (use --output=/path/to/output)`)
      process.exit(1)
    }
    if (!nginxFile) {
      console.error(
        `nginx file is not specified (use --nginx-file=/path/to/nginx.conf)`
      )
      process.exit(1)
    }
    startHttpServer(async (server) => {
      console.log(
        `server started at http://${envConfig.hostname}:${config.port}`
      )
      await staticGen(output, nginxFile)
      server.close()
      process.exit(0)
    })
    break
  default:
    console.log(`unrecognized command: ${command}`)
}

export default {}
