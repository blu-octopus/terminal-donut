// terminal-donut: a spinning ASCII donut in your terminal.
//
//   npm start
//
// Keys: c color · +/- speed · space pause · arrows nudge · q quit

import { THEMES, createPose, stepPose, render } from './donut-core.js';
import { createTerminalGrid, present } from './renderer.js';

const once = !process.stdout.isTTY; // piped? draw one frame and exit
const MAX_SPEED = 3;

// ---- state -------------------------------------------------------------------
const settings = { theme: 0, speed: 1, paused: false };
const pose = createPose();
let grid = createTerminalGrid();

// Accepts partial updates, clamped to sane values.
function applySettings(msg) {
  if (Number.isInteger(msg.theme) && msg.theme >= 0 && msg.theme < THEMES.length) settings.theme = msg.theme;
  if (Number.isFinite(msg.speed)) settings.speed = Math.min(MAX_SPEED, Math.max(0, msg.speed));
  if (typeof msg.paused === 'boolean') settings.paused = msg.paused;
}

// ---- loop --------------------------------------------------------------------
let last = performance.now();

function frame() {
  const now = performance.now();
  const dt = once ? 0 : Math.min(0.1, (now - last) / 1000);
  last = now;

  render(grid, stepPose(pose, dt, settings));
  present(grid, THEMES[settings.theme], statusLine());
}

function statusLine() {
  const info = `${THEMES[settings.theme].name} · ${settings.paused ? 'paused' : `${settings.speed.toFixed(1)}x`}`;
  return ` ${info} · arrows nudge · space pause · c color · +/- speed · q quit`;
}

// ---- keyboard ------------------------------------------------------------------
function quit() {
  process.stdout.write('\x1b[0m\x1b[?25h\x1b[2J\x1b[H');
  process.exit(0);
}

function onKey(key) {
  switch (key) {
    case '\u0003': // Ctrl+C
    case 'q':
      return quit();
    case 'c':
      return applySettings({ theme: (settings.theme + 1) % THEMES.length });
    case '+':
    case '=':
      return applySettings({ speed: Math.round((settings.speed + 0.25) * 4) / 4, paused: false });
    case '-':
    case '_':
      return applySettings({ speed: Math.round((settings.speed - 0.25) * 4) / 4 });
    case ' ':
      return applySettings({ paused: !settings.paused });
    case '\x1b[A': pose.A -= 0.3; break; // up
    case '\x1b[B': pose.A += 0.3; break; // down
    case '\x1b[C': pose.B -= 0.3; break; // right
    case '\x1b[D': pose.B += 0.3; break; // left
  }
}

if (once) {
  pose.B = 0.5;
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
