import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createServer } from 'vite'

const root = new URL('../..', import.meta.url).pathname
const profile = await mkdtemp(join(tmpdir(), 'private-balance-indexeddb-'))
const server = await createServer({
  configFile: false,
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForChildExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  }

  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal })
    })
  })
}

function signalChild(child, signal) {
  if (child === undefined || child.pid === undefined) {
    return
  }

  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal)
      return
    }
  } catch {
    // Fallback to direct child signaling below.
  }

  try {
    child.kill(signal)
  } catch {
    // The process may have already exited.
  }
}

async function terminateChild(child) {
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) {
    if (child !== undefined) {
      await waitForChildExit(child)
    }
    return
  }

  signalChild(child, 'SIGTERM')

  const exited = await Promise.race([
    waitForChildExit(child).then(() => true),
    delay(3000).then(() => false),
  ])

  if (!exited && child.exitCode === null && child.signalCode === null) {
    signalChild(child, 'SIGKILL')
    await waitForChildExit(child)
  }
}

async function closeSocket(socket) {
  if (socket === undefined || socket.readyState === WebSocket.CLOSED) {
    return
  }

  const closePromise = new Promise((resolve) => {
    const done = () => resolve()
    socket.addEventListener('close', done, { once: true })
    socket.addEventListener('error', done, { once: true })
    try {
      socket.close()
    } catch {
      resolve()
    }
  })

  await Promise.race([closePromise, delay(1000)])
}

function waitForBrowserSocket(child, readStderr) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Chrome debugging endpoint timeout\n${readStderr()}`))
    }, 10000)

    const onStderr = () => {
      const match = readStderr().match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match !== null) {
        cleanup()
        resolve(match[1])
      }
    }

    const onExit = (code, signal) => {
      cleanup()
      reject(
        new Error(
          `Chrome exited before exposing DevTools endpoint (code=${code ?? 'null'}, signal=${signal ?? 'null'})\n${readStderr()}`,
        ),
      )
    }

    const onError = (error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      clearTimeout(timeout)
      child.stderr.off('data', onStderr)
      child.off('exit', onExit)
      child.off('error', onError)
    }

    child.stderr.on('data', onStderr)
    child.on('exit', onExit)
    child.on('error', onError)
  })
}

let child
let socket
let stderr = ''

try {
  await server.listen()
  const address = server.httpServer.address()
  if (address === null || typeof address === 'string') throw new Error('Vite did not bind a TCP port')

  const chrome = process.env.CHROME_BIN ?? 'google-chrome'
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    `http://127.0.0.1:${address.port}/test/indexeddb/browser.html`,
  ]
  child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })

  const browserSocket = await waitForBrowserSocket(child, () => stderr)
  const endpoint = new URL(browserSocket)
  let pages = []
  for (let attempt = 0; attempt < 100; attempt += 1) {
    pages = await fetch(`http://${endpoint.host}/json/list`).then((response) => response.json())
    if (pages.some((page) => page.url.includes('/test/indexeddb/browser.html'))) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  const page = pages.find((candidate) => candidate.url.includes('/test/indexeddb/browser.html'))
  if (page === undefined) throw new Error(`IndexedDB test page was not created\n${stderr}`)

  socket = new WebSocket(page.webSocketDebuggerUrl)
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
  if (report == null) {
    throw new Error(`IndexedDB browser report timeout\n${stderr}`)
  }

  const details = report?.text === undefined ? undefined : JSON.parse(report.text)
  if (report?.status !== 'passed') {
    throw new Error(`Real IndexedDB browser test failed\n${JSON.stringify(details, null, 2)}\nChrome:\n${stderr}`)
  }
  console.log(JSON.stringify(details, null, 2))
} finally {
  await terminateChild(child)
  await closeSocket(socket)
  await server.close()
  await rm(profile, { recursive: true, force: true })
}
