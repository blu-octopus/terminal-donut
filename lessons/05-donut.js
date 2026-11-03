// STEP 5 — Light. The holy grail.
//
// Big idea: how bright a surface looks depends on whether it FACES the light.
//
//   - Every point on the surface has a NORMAL: an arrow, length 1, pointing
//     straight out of the surface. For our small circle, the normal at angle θ
//     is simply (cos θ, sin θ, 0). Then we rotate the normal with the exact
//     same rotations as the point, so it keeps pointing "out".
//   - The light is another unit arrow: the direction toward the light.
//   - The DOT PRODUCT of two unit arrows = cos(angle between them).
//       1 → facing the light head-on    0 → edge-on    < 0 → facing away
//     That number is the brightness ("Lambert" or diffuse lighting).
//   - Map brightness to a character ramp, from dim to bright.
//
// This is a cleaned-up, readable version of Andy Sloane's famous donut.c (2006).
//
// Run:  npm run step5   (Ctrl+C to quit)

const ASPECT = 2;
const R1 = 1, R2 = 2, K2 = 5;
const THETA_STEP = 0.07; // around the tube
const PHI_STEP = 0.02; // around the donut
const SHADES = '.,-~:;=!*#$@'; // dim → bright, 12 levels
const LIGHT = normalize([0, 1, -1]); // up, and toward the viewer

let width, height, buffer, zbuffer, K1;

function resize() {
  width = process.stdout.columns || 80;
  height = (process.stdout.rows || 24) - 1;
  buffer = new Array(width * height);
  zbuffer = new Float32Array(width * height);
  K1 = Math.min(width / ASPECT, height) * K2 * 3 / (8 * (R1 + R2));
}

// ---- tiny vector math library -------------------------------------------
function normalize([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
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

// ---- renderer -------------------------------------------------------------
function render(A, B) {
  buffer.fill(' ');
  zbuffer.fill(0);

  for (let theta = 0; theta < Math.PI * 2; theta += THETA_STEP) {
    const ct = Math.cos(theta), st = Math.sin(theta);

    for (let phi = 0; phi < Math.PI * 2; phi += PHI_STEP) {
      // Same shape as step 4, plus its normal riding along.
      let p = [R2 + R1 * ct, R1 * st, 0];
      let n = [ct, st, 0];
      p = rotateZ(rotateX(rotateY(p, phi), A), B);
      n = rotateZ(rotateX(rotateY(n, phi), A), B);

      const ooz = 1 / (p[2] + K2);
      const sx = Math.round(width / 2 + K1 * ASPECT * ooz * p[0]);
      const sy = Math.round(height / 2 - K1 * ooz * p[1]);
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

      const i = sy * width + sx;
      if (ooz <= zbuffer[i]) continue;
      zbuffer[i] = ooz;

      const L = dot(n, LIGHT); // -1 … 1
      buffer[i] = L > 0
        ? SHADES[Math.min(SHADES.length - 1, Math.floor(L * SHADES.length))]
        : ' '; // in shadow
    }
  }
}

function present() {
  let out = '';
  for (let y = 0; y < height; y++) {
    out += buffer.slice(y * width, (y + 1) * width).join('');
    if (y < height - 1) out += '\n';
  }
  process.stdout.write('\x1b[H' + out);
}

// ---- loop -----------------------------------------------------------------
resize();
const start = performance.now();

function frame() {
  const t = (performance.now() - start) / 1000;
  render(t * 1.2, t * 0.6);
  present();
}

process.stdout.write('\x1b[2J\x1b[?25l');
process.stdout.on('resize', () => {
  resize();
  process.stdout.write('\x1b[2J');
});
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h\n');
  process.exit(0);
});

if (process.stdout.isTTY) setInterval(frame, 1000 / 30);
else frame();

// TRY THIS
// 1. Move the light: LIGHT = normalize([1, 0, -1]). Then [0, -1, 0].
// 2. Make the light orbit: compute LIGHT inside frame() from t.
// 3. Swap SHADES for your own ramp (try ' ░▒▓█' or emoji — what breaks?).
// 4. Notice: render(A, B) only needs two numbers. In phase 3 those numbers
//    will come from your phone's tilt instead of from the clock.
