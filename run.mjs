import concurrently from 'concurrently'

const args = process.argv.slice(2).join(' ')

concurrently(
  [
    { command: 'yarn run watch-ts', prefixColor: 'blue', name: 'ts' },
    {
      command: `yarn run watch-node ${args}`,
      prefixColor: 'magenta',
      name: 'node',
    },
  ],
  {
    killOthers: ['failure', 'success'],
  }
)
