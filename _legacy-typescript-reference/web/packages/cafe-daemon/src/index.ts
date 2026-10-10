/**
 * CAFE Print Daemon
 *
 * Minimal HTTP server that receives pre-built ESC/POS bytes from the POS
 * browser client and writes them directly to the thermal printer device.
 *
 * Install as a persistent background service:
 *   Linux:  systemd unit (see README)
 *   macOS:  launchd LaunchAgent (see README)
 *
 * Environment variables:
 *   CAFE_PRINTER_DEVICE  path to printer device (default: /dev/usb/lp0)
 *   CAFE_DAEMON_PORT     HTTP port (default: 9876)
 *
 * HTTP contract:
 *   POST /print
 *   Content-Type: application/octet-stream
 *   Body: ESC/POS Uint8Array
 *   → 200 OK             (bytes written to printer)
 *   → 503 Unavailable    (printer device not accessible)
 *   → 400 Bad Request    (empty body)
 *
 *   GET /health
 *   → 200 OK  { status: "ok", device: "...", printerReachable: true|false }
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const DEVICE = process.env.CAFE_PRINTER_DEVICE ?? '/dev/usb/lp0';
const PORT = parseInt(process.env.CAFE_DAEMON_PORT ?? '9876', 10);

function isPrinterAvailable(): boolean {
  try {
    fs.accessSync(DEVICE, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeToPrinter(data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(DEVICE, { flags: 'a' });
    stream.on('error', reject);
    stream.write(data, (err) => {
      if (err) { stream.destroy(); reject(err); return; }
      stream.end(() => resolve());
    });
  });
}

function collectBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? '/';

  if (req.method === 'GET' && url === '/health') {
    const printerReachable = isPrinterAvailable();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', device: DEVICE, printerReachable }));
    return;
  }

  if (req.method === 'POST' && url === '/print') {
    if (!isPrinterAvailable()) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end(`Printer device not accessible: ${DEVICE}`);
      return;
    }

    let body: Buffer;
    try {
      body = await collectBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Failed to read request body');
      return;
    }

    if (body.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Empty body');
      return;
    }

    try {
      await writeToPrinter(body);
      console.log(`[cafe-daemon] Printed ${body.length} bytes to ${DEVICE}`);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } catch (err) {
      console.error('[cafe-daemon] Write error:', err);
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end(`Write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[cafe-daemon] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[cafe-daemon] Printer device: ${DEVICE}`);
  console.log(`[cafe-daemon] Printer available: ${isPrinterAvailable()}`);
});

server.on('error', (err) => {
  console.error('[cafe-daemon] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
