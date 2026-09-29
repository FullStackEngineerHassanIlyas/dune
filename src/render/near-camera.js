// Ambient effects (dust, tread marks) are only worth making near what the camera looks at: far-off
// vehicles would re-upload the whole track canvas for marks nobody sees.
export const nearCamera = (x, z, tx, tz, distance, factor = 1.5) => Math.hypot(x - tx, z - tz) <= distance * factor;
