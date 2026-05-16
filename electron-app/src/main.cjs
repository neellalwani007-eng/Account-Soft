'use strict'

const { app, BrowserWindow, dialog, shell } = require('electron')
const path = require('path')
const net  = require('net')
const http = require('http')
const fs   = require('fs')

const isDev         = !app.isPackaged
const resourcesPath = isDev
  ? path.join(__dirname, '..')
  : process.resourcesPath

function getFreePort () {
  return new Promise(resolve => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

function waitForServer (port, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0
    const attempt = () => {
      http.get(`http://127.0.0.1:${port}/api/healthz`, res => {
        if (res.statusCode < 500) return resolve()
        retry()
      }).on('error', retry)
    }
    const retry = () => {
      if (++n < maxAttempts) setTimeout(attempt, 500)
      else reject(new Error('Server did not start in time'))
    }
    attempt()
  })
}

let mainWindow

function createWindow (port) {
  mainWindow = new BrowserWindow({
    width:   1280,
    height:  800,
    minWidth:  960,
    minHeight: 600,
    title: 'AccountSoft',
    show: false,
    backgroundColor: '#0f172a',
    icon: path.join(resourcesPath, 'assets', 'accountsoft.ico'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.loadURL('data:text/html,' + encodeURIComponent(`
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #0f172a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
            color: #94a3b8;
          }
          .logo { font-size: 28px; font-weight: 800; color: #38bdf8; margin-bottom: 12px; }
          .sub { font-size: 13px; color: #475569; margin-bottom: 40px; }
          .spinner {
            width: 36px; height: 36px;
            border: 3px solid #1e293b;
            border-top-color: #38bdf8;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .status { margin-top: 16px; font-size: 12px; color: #334155; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="logo">AccountSoft</div>
        <div class="sub">Offline Accounting for Indian Businesses</div>
        <div class="spinner"></div>
        <div class="status">Starting up...</div>
      </body>
    </html>
  `))

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  try {
    const port   = await getFreePort()
    const dbPath = path.join(app.getPath('userData'), 'data')

    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true })

    const dbFile    = path.join(dbPath, 'accountsoft.db')
    const bundledDb = path.join(resourcesPath, 'data', 'accountsoft.db')
    if (!fs.existsSync(dbFile) && fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, dbFile)
    }

    process.env.PORT     = String(port)
    process.env.NODE_ENV = 'production'
    process.env.DB_PATH  = dbPath

    const frontendDir = path.join(resourcesPath, 'frontend')
    process.env.STATIC_DIR = frontendDir

    // Show window immediately with loading screen
    createWindow(port)

    // Start server in background
    const serverMod   = require('./server-bundle.cjs')
    const startServer = serverMod.startServer || serverMod.default || serverMod

    if (typeof startServer === 'function') {
      await startServer(port, frontendDir)
    } else {
      await waitForServer(port)
    }

    // Server ready — load the real app
    mainWindow.loadURL(`http://127.0.0.1:${port}`)

  } catch (err) {
    dialog.showErrorBox('AccountSoft - Startup Error', String(err))
    app.quit()
  }
})

app.on('window-all-closed', () => app.quit())
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow) mainWindow.show()
})
