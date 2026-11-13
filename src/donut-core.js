// The donut engine, shared by the terminal (Node) and the phone (browser).
// No Node or DOM APIs in here — just math.

import * as Q from './math.js';

export const ASPECT = 2; // character cells are ~2× taller than wide
const R1 = 1, R2 = 2, K2 = 5;
const THETA_STEP = 0.07, PHI_STEP = 0.02;
export const SHADES = '.,-~:;=!*#$@';
const LIGHT = [0, 1 / Math.SQRT2, -1 / Math.SQRT2]; // up, and toward the viewer

export const EMPTY = -1;
export const SHADOW = -2;

// 256-color palettes, dim → bright (works in macOS Terminal and everything else).
export const THEMES = [
  { name: 'pink', colors: [53, 89, 90, 125, 126, 162, 163, 199, 205, 212, 218, 225] },
  { name: 'sunset', colors: [52, 88, 124, 160, 196, 202, 208, 214, 220, 221, 228, 230] },
  { name: 'ocean', colors: [17, 18, 19, 20, 26, 32, 38, 44, 45, 51, 87, 159] },
  { name: 'matcha', colors: [22, 28, 34, 40, 70, 76, 106, 112, 148, 154, 192, 230] },
  { name: 'mono', colors: [237, 239, 241, 243, 245, 247, 249, 251, 252, 253, 254, 255] },
];

// xterm 256-color index → CSS rgb(), so the phone matches the terminal exactly.
export function xtermToCss(n) {
  let r, g, b;
  if (n >= 232) {
    r = g = b = 8 + (n - 232) * 10;
  } else if (n >= 16) {
    const i = n - 16;
    const level = (v) => (v === 0 ? 0 : 55 + v * 40);
    r = level(Math.floor(i / 36));
    g = level(Math.floor(i / 6) % 6);
    b = level(i % 6);
  } else {
    r = g = b = 128; // the 16 basic colors vary by terminal; we don't use them
  }
  return `rgb(${r},${g},${b})`;
}

// ---- rendering --------------------------------------------------------------

export function createGrid(width, height) {
  return {
    width,
    height,
    shade: new Int8Array(width * height),
    zbuf: new Float32Array(width * height),
    K1: Math.min(width / ASPECT, height) * K2 * 3 / (8 * (R1 + R2)),
  };
}

// Fills grid.shade with an index into SHADES (or EMPTY / SHADOW) per cell.
export function render(grid, M) {
  const { width, height, shade, zbuf, K1 } = grid;
  shade.fill(EMPTY);
  zbuf.fill(0);
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;

  for (let theta = 0; theta < Math.PI * 2; theta += THETA_STEP) {
    const ct = Math.cos(theta), st = Math.sin(theta);
    const cx = R2 + R1 * ct, cy = R1 * st;

    for (let phi = 0; phi < Math.PI * 2; phi += PHI_STEP) {
      const cp = Math.cos(phi), sp = Math.sin(phi);
      // Sweep the circle around y (rotateY by phi), for the point and its normal.
      const px = cx * cp, py = cy, pz = -cx * sp;
      const nx = ct * cp, ny = st, nz = -ct * sp;

      const x = m0 * px + m1 * py + m2 * pz;
      const y = m3 * px + m4 * py + m5 * pz;
      const z = m6 * px + m7 * py + m8 * pz;

      const ooz = 1 / (z + K2);
      const sx = Math.round(width / 2 + K1 * ASPECT * ooz * x);
      const sy = Math.round(height / 2 - K1 * ooz * y);
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

      const i = sy * width + sx;
      if (ooz <= zbuf[i]) continue;
      zbuf[i] = ooz;

      const L = (m3 * nx + m4 * ny + m5 * nz) * LIGHT[1] +
        (m6 * nx + m7 * ny + m8 * nz) * LIGHT[2];
      shade[i] = L > 0 ? Math.min(SHADES.length - 1, Math.floor(L * SHADES.length)) : SHADOW;
    }
  }
}

// ---- motion -----------------------------------------------------------------

const SPIN_A = 1.2; // radians per second at 1× speed
const SPIN_B = 0.6;
const FOLLOW_PHONE = 14; // how snappily the donut follows the phone (higher = tighter)
const FOLLOW_AUTO = 4; // how gently it glides back when tilt stops

export function createPose() {
  return {
    A: 0.9, // start tipped toward you so you can see the hole
    B: 0,
    current: Q.mul(Q.IDENTITY, Q.axisAngle(1, 0, 0, 0.9)),
    tilt: null, // latest phone quaternion, or null when tilt is off
    ref: null, // phone pose that counts as "neutral" (set on recenter)
  };
}

export function setTilt(pose, alpha, beta, gamma) {
  pose.tilt = Q.fromDeviceOrientation(alpha, beta, gamma);
  if (!pose.ref) pose.ref = pose.tilt;
}

// Advances the spin and eases toward the target. Returns a 3×3 matrix.
// With tilt on, the phone rotates the whole spinning donut.
export function stepPose(pose, dt, { speed, paused }) {
  if (!paused) {
    pose.A += SPIN_A * speed * dt;
    pose.B += SPIN_B * speed * dt;
  }
  let target = Q.mul(Q.axisAngle(0, 0, 1, pose.B), Q.axisAngle(1, 0, 0, pose.A));
  let follow = FOLLOW_AUTO;
  if (pose.tilt) {
    const rel = Q.phoneToScene(Q.mul(Q.conj(pose.ref), pose.tilt));
    target = Q.mul(rel, target);
    follow = FOLLOW_PHONE;
  }
  pose.current = dt > 0 ? Q.slerp(pose.current, target, 1 - Math.exp(-follow * dt)) : target;
  return Q.toMatrix(pose.current);
}
