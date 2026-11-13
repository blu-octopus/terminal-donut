// Quaternions: a 4-number way to store a 3D rotation that never gets stuck
// (no gimbal lock) and blends smoothly. Format: [w, x, y, z].

const DEG = Math.PI / 180;

export const IDENTITY = [1, 0, 0, 0];

export function axisAngle(x, y, z, angle) {
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

export function mul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

export function conj([w, x, y, z]) {
  return [w, -x, -y, -z];
}

function normalize(q) {
  const len = Math.hypot(...q);
  return q.map((v) => v / len);
}

// Blend from a to b by t (0…1) along the shortest arc.
export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) {
    b = b.map((v) => -v);
    d = -d;
  }
  if (d > 0.9995) return normalize(a.map((v, i) => v + (b[i] - v) * t));
  const theta = Math.acos(d);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return normalize(a.map((v, i) => v * wa + b[i] * wb));
}

// 3×3 rotation matrix, row-major, for fast per-point transforms.
export function toMatrix([w, x, y, z]) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

// How far apart two rotations are, in radians.
export function angleBetween(a, b) {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}

// Phone tilt → quaternion. Uses only beta (front/back) and gamma (left/right)
// from DeviceOrientationEvent, so a phone lying flat is "no rotation" no
// matter which compass direction it points. (The spec's full rotation is
// Z(alpha)·X(beta)·Y(gamma); dropping alpha drops the compass heading.)
export function fromTilt(beta, gamma) {
  return mul(axisAngle(1, 0, 0, beta * DEG), axisAngle(0, 1, 0, gamma * DEG));
}

// Flip to -1 if tilting feels backwards: it mirrors both tilt axes.
export const TILT_DIRECTION = 1;

// Maps a phone rotation onto the donut.
export function phoneToScene([w, x, y, z]) {
  return [w, TILT_DIRECTION * x, TILT_DIRECTION * y, z];
}
