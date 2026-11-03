// STEP 3 — From a circle to a donut (a "torus").
//
// Big idea: a torus is a circle swept around another circle.
//
//   1. Draw a small circle (radius R1), pushed out from the center by R2.
//      It lives in the x/y plane:   (R2 + R1·cos θ,  R1·sin θ,  0)
//   2. Spin that circle around the vertical (y) axis by angle φ.
//      Every (θ, φ) pair is one point on the donut's surface.
//
//   side view of step 1:      top view after step 2:
//
//        y                         .-~~~-.
//        |    ( o )  <- R1        /  .-.  \
//        +------>  x             |  (   )  |
//          <-R2->                 \  '-'  /
//                                  '-...-'
//
// We now have 3D points (x, y, z). The screen is 2D, so for now we just
// throw z away ("orthographic projection"). Notice the result is see-through:
// the back of the donut draws on top of the front. Step 4 fixes that.
//
// Run:  npm run step3

const ASPECT = 2;
const R1 = 1; // thickness of the donut (tube radius)
const R2 = 2; // distance from donut center to tube center

const width = process.stdout.columns || 80;
const height = (process.stdout.rows || 24) - 1;
const buffer = new Array(width * height).fill(' ');

function plot(x, y, ch) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  buffer[y * width + x] = ch;
}

// Rotation matrices, written out by hand. Each one spins a point around one
// axis by angle a and leaves that axis's coordinate alone.
function rotateX([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function rotateY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

const scale = Math.min(width / ASPECT, height) / 2 / (R1 + R2) * 0.9;
const TILT = 1.0; // tip the donut toward us so it reads as a ring, not a line

for (let theta = 0; theta < Math.PI * 2; theta += 0.15) {
  for (let phi = 0; phi < Math.PI * 2; phi += 0.05) {
    let p = [R2 + R1 * Math.cos(theta), R1 * Math.sin(theta), 0]; // small circle
    p = rotateY(p, phi); // sweep it around → torus
    p = rotateX(p, TILT); // tip it toward the viewer
    const [x, y] = p; // orthographic: ignore z
    plot(width / 2 + x * scale * ASPECT, height / 2 - y * scale, '.');
    // ^ minus on y: in math y goes UP, on screens row numbers go DOWN.
  }
}

let out = '';
for (let y = 0; y < height; y++) {
  out += buffer.slice(y * width, (y + 1) * width).join('') + '\n';
}
process.stdout.write('\x1b[2J\x1b[H' + out);

// TRY THIS
// 1. Set TILT to 0, then to Math.PI / 2. Explain what you see.
// 2. Make R1 bigger than R2. (Spoiler: it stops being a donut.)
// 3. Only draw points where theta < Math.PI. Which half disappears?
