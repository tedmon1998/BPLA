const path = require('node:path')
const { pathToFileURL } = require('node:url')
const dotenv = require('dotenv')
const express = require('express')
const { app, BrowserWindow } = require('electron')

const isDev = !app.isPackaged
let localServer = null
let localServerPort = 35173

function loadEnv() {
  if (isDev) {
    dotenv.config({ path: path.join(process.cwd(), '.env') })
    return
  }
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) {
    dotenv.config({ path: path.join(portableDir, '.env') })
    return
  }
  const exeDir = path.dirname(process.execPath)
  dotenv.config({ path: path.join(exeDir, '.env') })
}

async function startLocalServer() {
  const secureApiUrl = pathToFileURL(
    path.join(app.getAppPath(), 'server', 'secureApi.mjs'),
  ).href
  const secureApi = await import(secureApiUrl)

  const webRoot = path.join(app.getAppPath(), 'dist')
  const local = express()
  local.disable('x-powered-by')
  local.use(express.json({ limit: '2kb' }))

  local.get('/api/attempt/status', secureApi.handleAttemptStatus)
  local.post('/api/attempt/activate', secureApi.handleActivateExpress)
  local.post('/api/attempt/finish', secureApi.handleFinishAttempt)
  local.get('/api/bootstrap', secureApi.handleBootstrap)
  local.post('/api/verify', secureApi.handleVerifyExpress)
  local.use(express.static(webRoot, { index: false }))
  local.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) {
      res.status(404).json({ ok: false, error: 'not_found' })
      return
    }
    res.sendFile(path.join(webRoot, 'index.html'), (err) => next(err))
  })

  await new Promise((resolve, reject) => {
    localServer = local
      .listen(localServerPort, '127.0.0.1', resolve)
      .on('error', reject)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadURL(`http://127.0.0.1:${localServerPort}`)
  }
}

app.whenReady().then(() => {
  loadEnv()
  ;(async () => {
    if (!isDev) {
      await startLocalServer()
    }
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })().catch((e) => {
    console.error('Failed to initialize desktop runtime:', e)
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (localServer) {
    try {
      localServer.close()
    } catch {}
  }
})
