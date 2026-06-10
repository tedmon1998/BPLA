const path = require('node:path')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { app, BrowserWindow, session } = require('electron')

const API_PORT = Number(process.env.PORT ?? 8787)
let apiProcess = null

function configureTileRequestHeaders() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const isOsmTile =
      details.url.includes('tile.openstreetmap.org') ||
      details.url.includes('.tile.openstreetmap.org')

    if (isOsmTile) {
      details.requestHeaders['Referer'] = 'https://www.openstreetmap.org/'
      details.requestHeaders['User-Agent'] =
        'PlanirovshikMarshruta/1.0 (desktop-app; map tiles via OpenStreetMap policy)'
    }

    callback({ requestHeaders: details.requestHeaders })
  })
}

function getServerScriptPath() {
  return path.join(app.getAppPath(), 'dist-server', 'server.cjs')
}

function waitForApiHealth(port, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs

    const tryOnce = () => {
      const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
        response.resume()
        if (response.statusCode === 200) {
          resolve(true)
          return
        }
        scheduleRetry()
      })

      request.on('error', scheduleRetry)
      request.setTimeout(1_000, () => {
        request.destroy()
        scheduleRetry()
      })
    }

    const scheduleRetry = () => {
      if (Date.now() >= deadline) {
        resolve(false)
        return
      }
      setTimeout(tryOnce, 250)
    }

    tryOnce()
  })
}

function startBundledApiServer() {
  return new Promise((resolve, reject) => {
    const scriptPath = getServerScriptPath()
    apiProcess = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(API_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    apiProcess.on('error', reject)

    apiProcess.stdout?.on('data', (chunk) => {
      process.stdout.write(`[mission-api] ${chunk}`)
    })

    apiProcess.stderr?.on('data', (chunk) => {
      process.stderr.write(`[mission-api] ${chunk}`)
    })

    apiProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`[mission-api] exited with code ${code}`)
      }
      apiProcess = null
    })

    waitForApiHealth(API_PORT).then((ready) => {
      if (ready) {
        resolve()
        return
      }
      stopBundledApiServer()
      reject(new Error(`Mission API did not start on port ${API_PORT}`))
    })
  })
}

function stopBundledApiServer() {
  if (!apiProcess || apiProcess.killed) return
  apiProcess.kill()
  apiProcess = null
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
  win.loadFile(indexPath)
}

app.whenReady().then(async () => {
  configureTileRequestHeaders()

  if (app.isPackaged) {
    try {
      await startBundledApiServer()
    } catch (error) {
      console.error(error)
      app.quit()
      return
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopBundledApiServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
