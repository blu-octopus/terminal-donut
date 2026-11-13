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
  { name: 'vapor', colors: [54, 55, 56, 92, 128, 164, 170, 206, 212, 218, 159, 195] },
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

const SPIN_A = 1.2; // auto-spin, radians per second at 1× speed
const SPIN_B = 0.6;
const FOLLOW_AUTO = 4; // how gently it glides back to auto-spin when tilt stops

// Tilt feel. The donut accelerates toward where the phone points, cruises at
// a capped speed, then eases out as it arrives. It never builds up spin.
const TILT_ACCEL = 4; // radians per second², for both easing in and easing out
const TILT_MAX_SPEED = 1.8; // radians per second at 1× speed (the speed slider scales it)
const SENSOR_SMOOTHING = 18; // filters sensor jitter before motion is planned
const MIRROR_FOLLOW = 20; // how tightly the terminal tracks the phone's pose

// Phone lying flat → donut seen from straight above (its hole faces you).
const TOP_DOWN = Q.axisAngle(1, 0, 0, -Math.PI / 2);

export function createPose() {
  return {
    A: 0.9, // start tipped toward you so you can see the hole
    B: 0,
    current: Q.axisAngle(1, 0, 0, 0.9),
    tilt: null, // where the phone points (scene space), or null when tilt is off
    smoothTilt: null,
    velocity: 0, // radians per second, while following tilt
  };
}

export function setTilt(pose, beta, gamma) {
  pose.tilt = Q.phoneToScene(Q.fromTilt(beta, gamma));
}

export function clearTilt(pose) {
  pose.tilt = null;
  pose.smoothTilt = null;
  pose.velocity = 0;
}

// Advances the donut by dt seconds. Returns a 3×3 matrix for render().
export function stepPose(pose, dt, { speed, paused }) {
  if (pose.tilt) {
    pose.smoothTilt = pose.smoothTilt
      ? Q.slerp(pose.smoothTilt, pose.tilt, 1 - Math.exp(-SENSOR_SMOOTHING * dt))
      : pose.tilt;
    moveToward(pose, Q.mul(pose.smoothTilt, TOP_DOWN), dt, TILT_MAX_SPEED * Math.max(0.25, speed));
  } else {
    if (!paused) {
      pose.A += SPIN_A * speed * dt;
      pose.B += SPIN_B * speed * dt;
    }
    const target = Q.mul(Q.axisAngle(0, 0, 1, pose.B), Q.axisAngle(1, 0, 0, pose.A));
    pose.current = dt > 0 ? Q.slerp(pose.current, target, 1 - Math.exp(-FOLLOW_AUTO * dt)) : target;
  }
  return Q.toMatrix(pose.current);
}

// Trapezoidal motion: speed up at TILT_ACCEL, never exceed maxSpeed, and slow
// down early enough to stop exactly on the target (v² = 2·a·distance).
function moveToward(pose, target, dt, maxSpeed) {
  const dist = Q.angleBetween(pose.current, target);
  if (dist < 1e-4) {
    pose.current = target;
    pose.velocity = 0;
    return;
  }
  const canStopFrom = Math.sqrt(2 * TILT_ACCEL * dist);
  pose.velocity = Math.min(maxSpeed, canStopFrom, pose.velocity + TILT_ACCEL * dt);
  const step = Math.min(dist, pose.velocity * dt);
  pose.current = Q.slerp(pose.current, target, step / dist);
}

// For a screen that mirrors another device: glide to its pose, absorbing
// network jitter. Returns a 3×3 matrix for render().
export function followPose(pose, q, dt) {
  pose.current = Q.slerp(pose.current, q, 1 - Math.exp(-MIRROR_FOLLOW * dt));
  return Q.toMatrix(pose.current);
}
