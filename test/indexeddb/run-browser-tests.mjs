import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createServer } from 'vite'

const root = new URL('../..', import.meta.url).pathname
const profile = await mkdtemp(join(tmpdir(), 'private-balance-indexeddb-'))
const configHome = join(profile, 'config')
const cacheHome = join(profile, 'cache')
const server = await createServer({
  configFile: false,
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})

try {
  await server.listen()
  const address = server.httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('Vite did not bind a TCP port')

  const chrome = process.env.CHROME_BIN ?? 'google-chrome'
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    `http://127.0.0.1:${address.port}/test/indexeddb/browser.html?run=${Date.now()}`,
  ]
  const child = spawn(chrome, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: profile,
      XDG_CONFIG_HOME: configHome,
      XDG_CACHE_HOME: cacheHome,
    },
  })
  let stdout = ''
  let stderr = ''
  let exited = false
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
  child.once('exit', () => { exited = true })
  child.once('error', (error) => { throw error })

  const browserSocket = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chrome debugging endpoint timeout\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 10000)
    const onOutput = () => {
      const match = `${stdout}\n${stderr}`.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match !== null) {
        clearTimeout(timeout)
        child.stdout.off('data', onOutput)
        child.stderr.off('data', onOutput)
        resolve(match[1])
      }
    }
    child.stdout.on('data', onOutput)
    child.stderr.on('data', onOutput)
  })
  const endpoint = new URL(browserSocket)
  let pages = []
  let endpointReady = false
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (exited) {
      throw new Error(`Chrome exited before exposing the debugging endpoint\nstdout:\n${stdout}\nstderr:\n${stderr}`)
    }
    try {
      pages = await fetch(`http://${endpoint.host}/json/list`, {
        signal: AbortSignal.timeout(200),
      }).then((response) => response.json())
      endpointReady = true
      if (pages.some((page) => page.url.includes('/test/indexeddb/browser.html?run='))) break
    } catch {
      // Chrome may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!endpointReady) throw new Error(`Chrome debugging endpoint timeout\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  const page = pages.find((candidate) => candidate.url.includes('/test/indexeddb/browser.html?run='))
  if (page === undefined) throw new Error(`IndexedDB test page was not created\n${stderr}`)

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let commandId = 0
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const id = ++commandId
    const timeout = setTimeout(() => reject(new Error('Chrome evaluation timeout')), 2000)
    const listener = (event) => {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      clearTimeout(timeout)
      socket.removeEventListener('message', listener)
      if (message.error !== undefined || message.result?.exceptionDetails !== undefined) {
        reject(new Error(`Chrome evaluation failed: ${JSON.stringify(message)}`))
        return
      }
      resolve(message.result.result.value)
    }
    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
  })

  let report
  for (let attempt = 0; attempt < 300; attempt += 1) {
    report = await evaluate(`(() => { const node = document.querySelector('#result'); return !node || node.dataset.status === 'running' ? null : { status: node.dataset.status, text: node.textContent } })()`)
    if (report != null) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  socket.close()
  child.kill('SIGTERM')
  const details = report?.text === undefined ? undefined : JSON.parse(report.text)
  if (report?.status !== 'passed') {
    throw new Error(`Real IndexedDB browser test failed\n${JSON.stringify(details, null, 2)}\nChrome:\n${stderr}`)
  }
  console.log(JSON.stringify(details, null, 2))
} finally {
  await server.close()
  await rm(profile, { recursive: true, force: true })
}
