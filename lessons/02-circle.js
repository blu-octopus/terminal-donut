// STEP 2 — Circles, and making things move.
//
// Big ideas:
//   1. A circle is just (cos a, sin a) for every angle a. This is called a
//      PARAMETRIC shape: instead of an equation, you walk a parameter (the
//      angle) and get points out. The donut is the same trick, twice.
//   2. Animation = clear, draw, show, repeat. Motion should be driven by
//      TIME, not by frame count, so it runs at the same speed on any machine.
//
// Run:  npm run step2   (Ctrl+C to quit)

const ASPECT = 2; // terminal cells are ~2× taller than wide (see step 1)

const width = process.stdout.columns || 80;
const height = (process.stdout.rows || 24) - 1;
const buffer = new Array(width * height).fill(' ');

function plot(x, y, ch) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  buffer[y * width + x] = ch;
}

function present() {
  let out = '';
  for (let y = 0; y < height; y++) {
    out += buffer.slice(y * width, (y + 1) * width).join('');
    if (y < height - 1) out += '\n';
  }
  // Only move the cursor home (no full clear) — clearing every frame flickers.
  process.stdout.write('\x1b[H' + out);
}

const cx = width / 2;
const cy = height / 2;
const radius = Math.min(width / ASPECT, height) / 2 - 2;
const start = performance.now();

function frame() {
  const t = (performance.now() - start) / 1000; // seconds since start
  buffer.fill(' ');

  // The circle: walk the angle from 0 to 2π (a full turn) in small steps.
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    plot(cx + Math.cos(a) * radius * ASPECT, cy + Math.sin(a) * radius, '.');
  }

  // A dot orbiting at 1 radian per second.
  const a = t * 1.0;
  plot(cx + Math.cos(a) * radius * ASPECT, cy + Math.sin(a) * radius, '@');

  present();
}

// Hide the cursor while animating, and always restore it on exit.
process.stdout.write('\x1b[2J\x1b[?25l');
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h\n');
  process.exit(0);
});

if (process.stdout.isTTY) setInterval(frame, 1000 / 30); // ~30 frames per second
else frame(); // piped to a file? draw one frame and stop

// TRY THIS
// 1. Delete "* ASPECT" from both lines. What happens to the circle?
// 2. Make the dot go the other way. Make it go twice as fast.
// 3. Add a second dot on a smaller circle, orbiting at a different speed.
// 4. Change the step from 0.05 to 0.5. Why does the circle get gappy?
