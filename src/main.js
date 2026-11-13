// terminal-donut: a spinning ASCII donut you can steer by tilting your phone.
//
//   npm start               donut + phone controller (shows a QR code to scan)
//   npm start -- --no-phone donut only, keyboard controls
//
// Keys: c color · +/- speed · space pause · arrows nudge · p QR · r recenter · q quit

import qrcode from 'qrcode-terminal';
import { THEMES, createPose, setTilt, stepPose, render } from './donut-core.js';
import { createTerminalGrid, present } from './renderer.js';
import { startServer, startTunnel } from './server.js';

const usePhone = !process.argv.includes('--no-phone');
const once = !process.stdout.isTTY; // piped? draw one frame and exit

const PHONE_TIMEOUT_MS = 1500; // no tilt data this long → stop following the phone
const MAX_SPEED = 3;

// ---- state -------------------------------------------------------------------
// `shared` is what the phone controller can see and change.
const shared = { theme: 0, speed: 1, paused: false };
const state = {
  pose: createPose(),
  clients: 0,
  lastTiltAt: 0,
  url: null,
  tunnelError: null,
  showQR: true,
  qrLines: null,
};

let grid = createTerminalGrid();
let broadcast = () => {};

function syncPhones() {
  broadcast({ t: 'state', ...shared });
}

// Accepts partial updates from the phone or keyboard, clamped to sane values.
function applySettings(msg) {
  if (Number.isInteger(msg.theme) && msg.theme >= 0 && msg.theme < THEMES.length) shared.theme = msg.theme;
  if (Number.isFinite(msg.speed)) shared.speed = Math.min(MAX_SPEED, Math.max(0, msg.speed));
  if (typeof msg.paused === 'boolean') shared.paused = msg.paused;
  syncPhones();
}

function recenter() {
  state.pose.ref = null; // next reading becomes "neutral"
}

// ---- phone -------------------------------------------------------------------
let stopTunnel = () => {};
if (usePhone && !once) {
  const server = await startServer({
    onMessage(msg) {
      if (msg.t === 'o' && [msg.a, msg.b, msg.g].every(Number.isFinite)) {
        setTilt(state.pose, msg.a, msg.b, msg.g);
        state.lastTiltAt = performance.now();
      } else if (msg.t === 'tilt' && msg.on === false) {
        state.pose.tilt = null;
      } else if (msg.t === 'recenter') {
        recenter();
      } else if (msg.t === 'set') {
        applySettings(msg);
      }
    },
    onClientsChange(n, ws) {
      state.clients = n;
      if (n > 0) state.showQR = false;
      if (n === 0) state.pose.tilt = null;
      if (ws) ws.send(JSON.stringify({ t: 'state', ...shared }));
    },
  });
  broadcast = server.broadcast;
  stopTunnel = startTunnel(
    server.port,
    (url) => {
      state.url = url;
      qrcode.generate(url, { small: true }, (s) => {
        state.qrLines = [...s.replace(/\n+$/, '').split('\n'), '', ' scan with your phone camera '];
      });
    },
    (err) => (state.tunnelError = err),
  );
}

// ---- loop --------------------------------------------------------------------
let last = performance.now();

function frame() {
  const now = performance.now();
  const dt = once ? 0 : Math.min(0.1, (now - last) / 1000);
  last = now;

  if (state.pose.tilt && now - state.lastTiltAt > PHONE_TIMEOUT_MS) state.pose.tilt = null;

  render(grid, stepPose(state.pose, dt, shared));
  const overlay = state.showQR ? qrOverlay() : null;
  present(grid, THEMES[shared.theme], statusLine(), overlay);
}

// What sits where the QR code goes: the code itself, or why it isn't there yet.
function qrOverlay() {
  if (!usePhone || once || state.clients > 0) return null;
  const box = (msg) => {
    const bar = '─'.repeat(msg.length + 2);
    return { lines: [`┌${bar}┐`, `│ ${msg} │`, `└${bar}┘`] };
  };
  if (state.qrLines) return { lines: state.qrLines };
  if (state.tunnelError) return box(`phone link failed: ${state.tunnelError} (see .bin/tunnel.log)`);
  const dots = '.'.repeat(1 + (Math.floor(performance.now() / 400) % 3)).padEnd(3);
  return box(`connecting phone link${dots} QR code coming`);
}

function statusLine() {
  const info = `${THEMES[shared.theme].name} · ${shared.paused ? 'paused' : `${shared.speed.toFixed(1)}x`}`;
  const keys = 'c color · +/- speed · q quit';
  if (!usePhone) return ` ${info} · arrows nudge · space pause · ${keys}`;
  if (state.pose.tilt) return ` tilt on · ${info} · r recenter · ${keys}`;
  if (state.clients > 0) return ` phone connected · ${info} · ${keys}`;
  if (state.tunnelError) return ` phone unavailable (${state.tunnelError}) · ${keys}`;
  if (!state.url) return ` starting phone link… · ${keys}`;
  return ` ${state.url} · p qr · ${keys}`;
}

// ---- keyboard ------------------------------------------------------------------
function quit() {
  stopTunnel();
  process.stdout.write('\x1b[0m\x1b[?25h\x1b[2J\x1b[H');
  process.exit(0);
}

function onKey(key) {
  const pose = state.pose;
  switch (key) {
    case '\u0003': // Ctrl+C
    case 'q':
      return quit();
    case 'c':
      return applySettings({ theme: (shared.theme + 1) % THEMES.length });
    case '+':
    case '=':
      return applySettings({ speed: Math.round((shared.speed + 0.25) * 4) / 4, paused: false });
    case '-':
    case '_':
      return applySettings({ speed: Math.round((shared.speed - 0.25) * 4) / 4 });
    case ' ':
      return applySettings({ paused: !shared.paused });
    case 'p':
      state.showQR = !state.showQR;
      break;
    case 'r':
      recenter();
      broadcast({ t: 'recenter' });
      break;
    case '\x1b[A': pose.A -= 0.3; break; // up
    case '\x1b[B': pose.A += 0.3; break; // down
    case '\x1b[C': pose.B -= 0.3; break; // right
    case '\x1b[D': pose.B += 0.3; break; // left
  }
}

if (once) {
  state.pose.B = 0.5;
  frame();
  process.stdout.write('\n');
  process.exit(0);
}

process.stdout.write('\x1b[2J\x1b[?25l');
process.stdout.on('resize', () => {
  grid = createTerminalGrid();
  process.stdout.write('\x1b[2J');
});
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', onKey);
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

setInterval(frame, 1000 / 30);
