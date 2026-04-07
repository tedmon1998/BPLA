'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { URL } = require('node:url')
const { handleGameApi } = require('../server/gameApi.cjs')

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

/**
 * Serves `dist` and the same /api/* handlers as Vite dev middleware.
 */
function startStaticServer(distPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname

      if (pathname.startsWith('/api/')) {
        void handleGameApi(req, res, pathname)
        return
      }

      let rel = pathname === '/' ? 'index.html' : pathname.slice(1)
      rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
      const fullPath = path.join(distPath, rel)

      if (!fullPath.startsWith(distPath)) {
        res.statusCode = 403
        res.end()
        return
      }

      fs.readFile(fullPath, (err, data) => {
        if (err) {
          res.statusCode = 404
          res.end()
          return
        }
        const ext = path.extname(fullPath).toLowerCase()
        res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
        res.end(data)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ server, port })
    })
    server.on('error', reject)
  })
}

module.exports = { startStaticServer }
