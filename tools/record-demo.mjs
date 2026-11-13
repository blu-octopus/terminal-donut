// Records the demo stage (tools/demo-stage.html) with headless Chrome.
//
//   npm run web                                  # in one terminal (serves on :8000)
//   node --experimental-websocket tools/record-demo.mjs [outDir]
//   python3 tools/make-gif.py [outDir] docs/media/doughnut3d-x.gif
//
// Chrome streams frames as the page really renders them (a "screencast"), each
// with a timestamp. We let one loop play as a warm-up, keep the next full loop,
// and pick the frame nearest to every 1/FPS step, so the clip is evenly timed
// and loops seamlessly.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OUT = path.resolve(process.argv[2] ?? 'demo-frames');
const URL = process.env.DEMO_URL ?? 'http://127.0.0.1:8000/tools/demo-stage.html';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const LOOP = 11.2; // must match LOOP in demo-stage.html
const PORT = 9334;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'doughnut-rec-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--mute-audio',
  '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- minimal DevTools protocol client ------------------------------------------
let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method && listeners.has(msg.method)) listeners.get(msg.method)(msg.params);
};
const send = (method, params = {}) =>
  new Promise((r) => { const id = ++nextId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;

// ---- record --------------------------------------------------------------------
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
await send('Page.enable');
await send('Page.navigate', { url: URL });
let start;
for (let i = 0; i < 100 && !start; i++) { await sleep(100); start = await evaluate('window.stageStartEpoch'); }

const captured = []; // { t: seconds of stage time, data: jpeg base64 }
listeners.set('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  send('Page.screencastFrameAck', { sessionId });
  captured.push({ t: metadata.timestamp - start / 1000, data });
});
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 });

// Keep loop #2 (stage time LOOP…2·LOOP); loop #1 is the warm-up.
while ((Date.now() - start) / 1000 < 2 * LOOP + 0.3) {
  process.stdout.write(`\rrecording… ${((Date.now() - start) / 1000).toFixed(1)}s / ${(2 * LOOP).toFixed(1)}s`);
  await sleep(250);
}
await send('Page.stopScreencast');

const window = captured.filter((f) => f.t >= LOOP - 0.1 && f.t <= 2 * LOOP + 0.1);
const frames = Math.round(LOOP * FPS);
for (let i = 0; i < frames; i++) {
  const want = LOOP + i / FPS;
  const best = window.reduce((a, b) => (Math.abs(b.t - want) < Math.abs(a.t - want) ? b : a));
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(best.data, 'base64'));
}
const rate = window.length / LOOP;
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ fps: FPS, frames, width: WIDTH, height: HEIGHT, sourceFps: rate }));
console.log(`\rrecorded ${frames} frames (${LOOP}s at ${FPS} fps; Chrome delivered ~${rate.toFixed(0)} fps) → ${OUT}`);

ws.close();
chrome.kill();
fs.rmSync(profile, { recursive: true, force: true });
process.exit(0);
