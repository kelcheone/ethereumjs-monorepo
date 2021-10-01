import { spawn } from 'child_process'
import tape from 'tape'
import { Client } from 'jayson/promise'

// get args for --network and --syncmode
const cliArgs = process.argv.filter(
  (arg) => arg.startsWith('--network') || arg.startsWith('--syncmode') || arg.startsWith('--rpc')
)

tape('[CLI]', (t) => {
  t.test('should begin downloading blocks', { timeout: 260000 }, (t) => {
    const file = require.resolve('../../dist/bin/cli.js')
    const child = spawn(process.execPath, [file, ...cliArgs])
    let hasEnded = false
    const end = () => {
      if (hasEnded) return
      hasEnded = true
      child.stdout.removeAllListeners()
      child.stderr.removeAllListeners()
      child.kill('SIGINT')
    }

    child.stdout.on('data', async (data) => {
      const message = data.toString()

      // log message for easier debugging
      // eslint-disable-next-line no-console
      console.log(message)

      if (message.toLowerCase().includes('http endpoint')) {
        const client = Client.http({ port: 8545 })
        const res = await client.request('web3_clientVersion', [], 2.0)
        t.ok(res.result.includes('EthereumJS'), 'read from HTTP RPC')
      }

      if (message.toLowerCase().includes('wss endpoint')) {
        const client = Client.websocket({ url: 'ws://localhost:8544' })
        ;(client as any).ws.on('open', async function () {
          const res = await client.request('web3_clientVersion', [], 2.0)
          t.ok(res.result.includes('EthereumJS'), 'read from WSS RPC')
          ;(client as any).ws.close()
        })
      }
      if (message.toLowerCase().includes('error')) {
        t.fail(message)
        return end()
      }
      if (message.includes('Imported')) {
        t.pass('successfully imported blocks or headers')
        return end()
      }
    })

    child.stderr.on('data', (data) => {
      const message = data.toString()
      t.fail(`stderr: ${message}`)
      end()
    })

    child.on('close', (code) => {
      if (code > 0) {
        t.fail(`child process exited with code ${code}`)
        end()
      }
    })
  })
})
