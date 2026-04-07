const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { startStaticServer } = require('./serverHost.cjs')

const isDev = !app.isPackaged

let prodServer = null
let prodServerUrl = null

async function ensureProdServer() {
  if (isDev) {
    return 'http://localhost:5173'
  }
  if (prodServerUrl) {
    return prodServerUrl
  }
  const distPath = path.join(app.getAppPath(), 'dist')
  const { server, port } = await startStaticServer(distPath)
  prodServer = server
  prodServerUrl = `http://127.0.0.1:${port}/`
  return prodServerUrl
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  void ensureProdServer().then((url) => {
    win.loadURL(url)
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (prodServer) {
    prodServer.close()
    prodServer = null
    prodServerUrl = null
  }
})
