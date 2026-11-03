// STEP 4 — Spin, perspective, and depth.
//
// Three upgrades:
//
//   1. SPIN. Two angles that grow with time: A (around x) and B (around z).
//
//   2. PERSPECTIVE. Things further away look smaller. Push the donut K2 units
//      away from the camera, then divide by distance:
//          screenX = K1 · x / z      screenY = K1 · y / z
//      That one division is the whole trick behind every 3D game.
//
//   3. Z-BUFFER. Many 3D points land on the same character cell. Keep a second
//      array that remembers how close the nearest point drawn there is; only
//      draw a new point if it's closer. We store 1/z ("one over z") so that
//      bigger = closer and an empty cell (0) loses to anything.
//
// As a stand-in for lighting, we pick the character by depth: near = '@',
// far = '.'. It already looks 3D — but flat-ish. Step 5 adds real light.
//
// Run:  npm run step4   (Ctrl+C to quit)

const ASPECT = 2;
const R1 = 1, R2 = 2;
const K2 = 5; // how far the donut sits from the camera
const DEPTH_RAMP = '.:-=+*#%@'; // far → near

const width = process.stdout.columns || 80;
const height = (process.stdout.rows || 24) - 1;
const buffer = new Array(width * height);
const zbuffer = new Float32Array(width * height);

// K1 = screen scale, chosen so the donut fills ~3/4 of the shorter side.
const K1 = Math.min(width / ASPECT, height) * K2 * 3 / (8 * (R1 + R2));

function rotateX([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function rotateY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotateZ([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
}

function present() {
  let out = '';
  for (let y = 0; y < height; y++) {
    out += buffer.slice(y * width, (y + 1) * width).join('');
    if (y < height - 1) out += '\n';
  }
  process.stdout.write('\x1b[H' + out);
}

function render(A, B) {
  buffer.fill(' ');
  zbuffer.fill(0);

  for (let theta = 0; theta < Math.PI * 2; theta += 0.07) {
    for (let phi = 0; phi < Math.PI * 2; phi += 0.02) {
      let p = [R2 + R1 * Math.cos(theta), R1 * Math.sin(theta), 0];
      p = rotateZ(rotateX(rotateY(p, phi), A), B);

      const ooz = 1 / (p[2] + K2); // "one over z"
      const sx = Math.round(width / 2 + K1 * ASPECT * ooz * p[0]);
      const sy = Math.round(height / 2 - K1 * ooz * p[1]);
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

      const i = sy * width + sx;
      if (ooz <= zbuffer[i]) continue; // something closer is already here
      zbuffer[i] = ooz;

      // Map depth to a character. ooz ranges roughly 1/(K2+3) … 1/(K2-3).
      const near = 1 / (K2 - (R1 + R2));
      const far = 1 / (K2 + (R1 + R2));
      const d = (ooz - far) / (near - far); // 0 = far, 1 = near
      buffer[i] = DEPTH_RAMP[Math.min(DEPTH_RAMP.length - 1, Math.floor(d * DEPTH_RAMP.length))];
    }
  }
}

const start = performance.now();
function frame() {
  const t = (performance.now() - start) / 1000;
  render(t * 1.2, t * 0.6); // radians per second for A and B
  present();
}

process.stdout.write('\x1b[2J\x1b[?25l');
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h\n');
  process.exit(0);
});

if (process.stdout.isTTY) setInterval(frame, 1000 / 30);
else frame();

// TRY THIS
// 1. Comment out the z-buffer check (the "continue" line). What breaks?
// 2. Change K2 to 3.5, then 20. How does perspective change?
// 3. Freeze B at 0 so it only spins one way.
