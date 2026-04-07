const path = require('node:path')
const { app, BrowserWindow, session } = require('electron')

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

app.whenReady().then(() => {
  configureTileRequestHeaders()
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
