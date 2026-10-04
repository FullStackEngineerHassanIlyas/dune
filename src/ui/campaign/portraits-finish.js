// The painter's finish for the baked Mentat portraits (assets/campaign/portraits/bake.mjs): an anisotropic Kuwahara
// filter on the GPU, after Kyprianidis, Kang and Döllner (2009, with the polynomial sector weights of 2011). The
// picture's local structure (the structure tensor of its colour, smoothed) gives each pixel an orientation and how
// strongly oriented it is; each pixel then takes the average colour of whichever of eight sectors of an ellipse laid
// along that orientation is most even. Smooth shading breaks into strokes that follow the forms, edges stay sharp.
// Plain strings and numbers, no imports: the bake runs them in its page.

/** One triangle over the target. */
export const FINISH_VERT = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0); gl_Position = vec4(p, 0.0, 1.0); }`;

export const FINISH_HEAD = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
out vec4 o;
ivec2 P() { return ivec2(gl_FragCoord.xy); }
vec4 at(ivec2 p) { return texelFetch(uSrc, clamp(p, ivec2(0), textureSize(uSrc, 0) - 1), 0); }
`;

/** The structure tensor (E, F, G) of the colour, by Sobel differences, from straight (not premultiplied) RGBA. */
export const FINISH_SST = `${FINISH_HEAD}
void main() {
  ivec2 p = P();
  vec3 gx = (-1.0 * at(p + ivec2(-1, -1)).rgb - 2.0 * at(p + ivec2(-1, 0)).rgb - 1.0 * at(p + ivec2(-1, 1)).rgb
             + 1.0 * at(p + ivec2(1, -1)).rgb + 2.0 * at(p + ivec2(1, 0)).rgb + 1.0 * at(p + ivec2(1, 1)).rgb) / 4.0;
  vec3 gy = (-1.0 * at(p + ivec2(-1, -1)).rgb - 2.0 * at(p + ivec2(0, -1)).rgb - 1.0 * at(p + ivec2(1, -1)).rgb
             + 1.0 * at(p + ivec2(-1, 1)).rgb + 2.0 * at(p + ivec2(0, 1)).rgb + 1.0 * at(p + ivec2(1, 1)).rgb) / 4.0;
  o = vec4(dot(gx, gx), dot(gx, gy), dot(gy, gy), 1.0);
}`;

/** A Gaussian blur along one axis (uDir), sigma uSigma. */
export const FINISH_BLUR = `${FINISH_HEAD}
uniform ivec2 uDir;
uniform float uSigma;
void main() {
  ivec2 p = P();
  int n = int(ceil(2.5 * uSigma));
  vec4 s = vec4(0.0); float ws = 0.0;
  for (int i = -n; i <= n; i++) { float w = exp(-0.5 * float(i * i) / (uSigma * uSigma)); s += w * at(p + uDir * i); ws += w; }
  o = s / ws;
}`;

/** The filter itself: uRadius (px), uQ (sharpness of the choice between sectors), uAlpha (how far the ellipse may
 *  stretch). uTensor is the smoothed structure tensor. Transparent pixels add nothing; the alpha is kept as it was. */
export const FINISH_AKF = `${FINISH_HEAD}
uniform sampler2D uTensor;
uniform float uRadius, uQ, uAlpha;
const float PI = 3.14159265;
void main() {
  ivec2 p = P();
  vec4 self = at(p);
  if (self.a <= 0.0) { o = vec4(0.0); return; }
  vec3 g = texelFetch(uTensor, p, 0).xyz;
  float d = sqrt(max((g.x - g.z) * (g.x - g.z) + 4.0 * g.y * g.y, 0.0));
  float l1 = 0.5 * (g.x + g.z + d), l2 = 0.5 * (g.x + g.z - d);
  vec2 t = vec2(l1 - g.x, -g.y);
  t = length(t) > 0.0 ? normalize(t) : vec2(0.0, 1.0);
  float A = l1 + l2 > 0.0 ? (l1 - l2) / (l1 + l2) : 0.0;
  float phi = -atan(t.y, t.x);
  float a = uRadius * clamp((uAlpha + A) / uAlpha, 0.1, 2.0);
  float b = uRadius * clamp(uAlpha / (uAlpha + A), 0.1, 2.0);
  float cp = cos(phi), sp = sin(phi);
  mat2 SR = mat2(1.0 / a, 0.0, 0.0, 1.0 / b) * mat2(cp, -sp, sp, cp);
  int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp));
  int my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
  const float zeta = 0.33;
  float eta = (zeta + cos(PI / 8.0)) / (sin(PI / 8.0) * sin(PI / 8.0));
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  for (int j = -my; j <= my; j++) for (int i = -mx; i <= mx; i++) {
    vec2 v = SR * vec2(float(i), float(j));
    float r2 = dot(v, v);
    if (r2 > 1.0) continue;
    vec4 c4 = at(p + ivec2(i, j));
    if (c4.a <= 0.0) continue;
    vec3 c = c4.rgb;
    float w[8];
    float vxx = zeta - eta * v.x * v.x, vyy = zeta - eta * v.y * v.y, z, sum = 0.0;
    z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
    z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
    z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
    z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
    vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
    vxx = zeta - eta * u.x * u.x; vyy = zeta - eta * u.y * u.y;
    z = max(0.0, u.y + vxx); w[1] = z * z; sum += w[1];
    z = max(0.0, -u.x + vyy); w[3] = z * z; sum += w[3];
    z = max(0.0, -u.y + vxx); w[5] = z * z; sum += w[5];
    z = max(0.0, u.x + vyy); w[7] = z * z; sum += w[7];
    float gk = c4.a * exp(-3.125 * r2) / max(sum, 1e-6);
    for (int k = 0; k < 8; k++) { float wk = w[k] * gk; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
  }
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w <= 1e-6) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 var = abs(s[k] / m[k].w - mean * mean);
    float wk = 1.0 / (1.0 + pow(255.0 * (var.r + var.g + var.b), 0.5 * uQ));
    acc += vec4(mean * wk, wk);
  }
  o = vec4(acc.w > 0.0 ? acc.rgb / acc.w : self.rgb, self.a);
}`;

/** The finish's settings at the bake's 2.4 px per frame unit: a stroke about two and a half frame units across. */
export const FINISH = { radius: 6, q: 8, alpha: 1, sigma: 2.5 };
