// Angle helpers for headings in the map plane (0 = east, π/2 = south).
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function angleDiff(from, to) { return wrapAngle(to - from); }

export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(d) * maxStep);
}

export function lerpAngle(a, b, t) { return wrapAngle(a + angleDiff(a, b) * t); }
