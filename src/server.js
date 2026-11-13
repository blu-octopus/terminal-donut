// A tiny web server the phone connects to, plus an HTTPS tunnel so the phone
// is allowed to read its motion sensors (browsers only allow that on HTTPS).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The only files the phone may load. The engine modules are shared with the terminal.
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/src/math.js': ['src/math.js', 'text/javascript'],
  '/src/donut-core.js': ['src/donut-core.js', 'text/javascript'],
  '/ui/vapor.css': ['ui/vapor.css', 'text/css'],
  '/design-system.html': ['design-system.html', 'text/html; charset=utf-8'],
};

// onMessage(msg, reply) handles phone messages; onClientsChange(n, ws) fires on connect/disconnect.
export function startServer({ onMessage, onClientsChange, port = 0 }) {
  const server = http.createServer((req, res) => {
    const file = FILES[req.url.split('?')[0]];
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' });
    fs.createReadStream(path.join(root, file[0])).pipe(res);
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    onClientsChange(wss.clients.size, ws);
    ws.on('close', () => onClientsChange(wss.clients.size, null));
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (msg && typeof msg === 'object') onMessage(msg);
    });
  });

  const broadcast = (msg) => {
    const data = JSON.stringify(msg);
    for (const ws of wss.clients) if (ws.readyState === 1) ws.send(data);
  };

  return new Promise((resolve) => {
    server.listen(port, () =>
      resolve({ port: server.address().port, broadcast, close: () => server.close() }));
  });
}

// Starts a free Cloudflare quick tunnel and reports its public https URL.
export function startTunnel(port, onUrl, onError) {
  const local = path.join(root, '.bin', 'cloudflared');
  const bin = fs.existsSync(local) ? local : 'cloudflared';
  const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Keep cloudflared's output around for debugging.
  fs.mkdirSync(path.join(root, '.bin'), { recursive: true });
  const log = fs.createWriteStream(path.join(root, '.bin', 'tunnel.log'));

  let found = false;
  const scan = (chunk) => {
    log.write(chunk);
    const m = !found && String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      found = true;
      onUrl(m[0]);
    }
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  child.on('error', (err) => {
    log.write(`spawn error: ${err.message}\n`);
    onError(err.code === 'ENOENT' ? 'cloudflared not installed' : err.message);
  });
  child.on('exit', (code) => !found && onError(`tunnel exited (${code})`));

  return () => child.kill();
}
