// The territory map's shaders (spec §5.8; research.md §6: a tilted relief map of Arrakis in sand tones, the houses'
// lands tinted in their colours). The relief is baked once on the GPU: pass 1 computes the terrain (height and what
// the ground is made of) into a float texture, pass 2 turns it into colour with the sun's light and shade baked in
// (alpha = height), so a frame of the map costs a few texture reads. The surface shader lifts the mesh by that
// height, tints each region by its owner (with a flood front while land changes hands), draws the borders from a
// distance field and makes the mission's region pulse.

// Value noise read from a small repeating texture of random values (one filtered read per octave, the cell's
// fraction eased so it is smooth: a hashed noise in code made the driver's compiler take seconds), and its fractal
// sums. Each seed reads the texture at its own offset.
export const NOISE_SIZE = 256;
const NOISE = /* glsl */ `
  uniform sampler2D uNoise;   // NOISE_SIZE × NOISE_SIZE random values in [0, 1], repeating, linear
  float gnoise(vec2 p, uint s) {
    p += vec2(float(s) * 37.13, float(s) * 17.71);
    vec2 i = floor(p), f = p - i;
    f = f * f * (3.0 - 2.0 * f);
    return (texture2D(uNoise, (i + f + 0.5) / ${NOISE_SIZE.toFixed(1)}).r - 0.5) * 1.2;
  }
  float fbm(vec2 p, uint s, int octaves) {
    float sum = 0.0, amp = 0.5;
    for (int k = 0; k < octaves; k++) { sum += amp * gnoise(p, s + uint(k)); p = p * 2.03 + vec2(17.1, 9.3); amp *= 0.5; }
    return sum;
  }
  float ridged(vec2 p, uint s, int octaves) {
    float sum = 0.0, amp = 0.55;
    for (int k = 0; k < octaves; k++) { float n = 1.0 - abs(gnoise(p, s + uint(k)) * 1.4); sum += amp * n * n; p = p * 2.1 + vec2(3.1, 7.7); amp *= 0.5; }
    return sum;
  }
`;

export const BAKE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Pass 1: the terrain at each texel: (height, rock, canyon, ice). p is in map units (200 × 100, y south): open sand
 *  with seas of dunes, rock lands with ridged mountains cut by canyons, and ice caps of ragged outline at both poles. */
export const BAKE_TERRAIN = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform vec2 uMap;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * uMap, q = p / 32.0;
    vec2 w = vec2(fbm(q * 0.8, 11u, 3), fbm(q * 0.8 + vec2(5.2, 1.3), 12u, 3));
    float swell = fbm(q * 0.5 + w * 0.35, 1u, 3);
    float lands = fbm(p / 44.0 + vec2(3.7, 8.1), 2u, 3) + 0.2 * w.x;
    float rock = smoothstep(-0.14, 0.08, lands);
    // eroded ground everywhere (the rock lands the most), mountain ranges on the rock lands
    float crinkle = ridged(q * 3.6 + w * 1.6, 3u, 5);
    float ranges = ridged(q * 1.4 + w * 0.9, 7u, 4);
    float h = 0.26 + 0.2 * swell + crinkle * crinkle * (0.07 + 0.16 * rock) + rock * (0.05 + 0.62 * ranges * ranges * ranges);
    float cut = abs(fbm(p / 20.0 + w * 0.7, 4u, 3));
    float canyon = (1.0 - smoothstep(0.006, 0.024, cut)) * smoothstep(-0.2, 0.1, lands);
    h -= canyon * 0.05;
    float erg = smoothstep(0.0, 0.2, fbm(p / 38.0 + vec2(9.1, 2.4), 9u, 2)) * (1.0 - rock);
    float dune = 0.5 + 0.5 * sin(dot(p, vec2(0.8, 0.6)) * 1.3 + fbm(p / 10.0, 5u, 2) * 6.0);
    h += dune * dune * erg * 0.025;
    // ice caps with a ragged, sharp edge
    float lat = min(p.y, uMap.y - p.y);
    float edge = 6.5 + 13.0 * max(0.0, fbm(p / 15.0, 6u, 3) + 0.32);
    float ice = 1.0 - smoothstep(edge - 0.35, edge + 0.35, lat);
    h = mix(h, 0.34 + 0.12 * swell + 0.06 * crinkle, ice * 0.55);
    gl_FragColor = vec4(clamp(h, 0.0, 1.0), rock, canyon, ice);
  }
`;

/** Pass 2: the colour, lit by a sun in the north-west (the map's top left), with the height in alpha. */
export const BAKE_COLOUR = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform vec2 uMap;
  uniform sampler2D uTerrain;
  uniform vec2 uSize;     // texels
  uniform vec2 uWorld;    // the map's size in world units
  uniform float uRelief;  // world height of a relief value of 1
  varying vec2 vUv;
  ${NOISE}
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    vec4 t = texture2D(uTerrain, vUv);
    vec2 px = 1.0 / uSize;
    float hw = texture2D(uTerrain, vUv - vec2(px.x, 0.0)).r, he = texture2D(uTerrain, vUv + vec2(px.x, 0.0)).r;
    float hn = texture2D(uTerrain, vUv - vec2(0.0, px.y)).r, hs = texture2D(uTerrain, vUv + vec2(0.0, px.y)).r;
    vec2 cell = uWorld / uSize;
    const float BUMP = 2.2;   // the baked shading exaggerates the relief, as a painted map would
    vec3 n = normalize(vec3(-(he - hw) * uRelief * BUMP / (2.0 * cell.x), 1.0, -(hs - hn) * uRelief * BUMP / (2.0 * cell.y)));
    vec3 sun = normalize(vec3(-0.6, 0.75, -0.45));
    float light = max(dot(n, sun), 0.0);
    // hollows darker than the ground around them (a cheap ambient occlusion over a ring of eight texels)
    float around = 0.0;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398;
      around += texture2D(uTerrain, vUv + vec2(cos(a), sin(a)) * px * 7.0).r;
    }
    float hollow = clamp((around / 8.0 - t.r) * 9.0, -0.3, 0.6);
    float shade = (0.42 + 0.76 * light) * (1.0 - 0.55 * max(hollow, 0.0)) * (1.0 + 0.25 * max(-hollow, 0.0));
    vec2 p = vUv * uMap;
    float tone = clamp(0.5 + 1.1 * fbm(p / 11.0, 8u, 3), 0.0, 1.0);
    vec3 sandLo = lin(vec3(0.66, 0.44, 0.25)), sand = lin(vec3(0.79, 0.57, 0.33)), sandHi = lin(vec3(0.87, 0.68, 0.43));
    vec3 rockLo = lin(vec3(0.36, 0.25, 0.17)), rockHi = lin(vec3(0.62, 0.48, 0.34));
    vec3 canyon = lin(vec3(0.24, 0.15, 0.09));
    vec3 iceLo = lin(vec3(0.66, 0.73, 0.82)), iceHi = lin(vec3(0.93, 0.95, 0.97));
    vec3 col = tone < 0.5 ? mix(sandLo, sand, tone * 2.0) : mix(sand, sandHi, tone * 2.0 - 1.0);
    vec3 rock = mix(rockLo, rockHi, clamp(0.4 + 0.8 * (tone - 0.5) + (t.r - 0.45), 0.0, 1.0));
    col = mix(col, rock, smoothstep(0.25, 0.75, t.g * 0.85 + (1.0 - n.y) * 1.5));
    col = mix(col, canyon, t.b * 0.7);
    col *= shade;
    col = mix(col, mix(iceLo, iceHi, clamp(light * 1.25, 0.0, 1.0)), t.a);
    gl_FragColor = vec4(col, t.r);
  }
`;

export const SURFACE_VERTEX = /* glsl */ `
  uniform sampler2D uRelief;
  uniform float uReliefHeight;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y = textureLod(uRelief, uv, 0.0).a * uReliefHeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const SURFACE_FRAGMENT = /* glsl */ `
  uniform sampler2D uRelief;   // linear colour, alpha = height
  uniform sampler2D uRegion;   // region id / 255, nearest
  uniform sampler2D uEdge;     // distance to the nearest border / range, linear
  uniform float uRange;        // texels the border field spans
  uniform vec4 uFrom[28];      // per region: the tint before the flood (rgb linear, a = strength)…
  uniform vec4 uTo[28];        // …after it…
  uniform vec4 uFlood[28];     // …and the flood: origin (uv), radius and softness (in map heights)
  uniform float uTarget;       // the region to pulse (0: none)
  uniform float uPulse;        // 0..1
  varying vec2 vUv;
  void main() {
    vec3 base = texture2D(uRelief, vUv).rgb;
    int id = int(texture2D(uRegion, vUv).r * 255.0 + 0.5);
    float e = texture2D(uEdge, vUv).r * uRange;
    vec4 from = uFrom[id], to = uTo[id], fl = uFlood[id];
    float r = length((vUv - fl.xy) * vec2(2.0, 1.0));
    float k = 1.0 - smoothstep(fl.z - fl.w, fl.z, r);
    vec4 tint = mix(from, to, k);
    // a house's colour keeps the relief's light and shade; the ice is not let wash it out
    float lum = min(dot(base, vec3(0.2126, 0.7152, 0.0722)), 0.42);
    vec3 col = mix(base, tint.rgb * (0.12 + 2.4 * lum), tint.a);
    float front = (1.0 - smoothstep(0.0, fl.w, abs(r - fl.z + fl.w * 0.5))) * step(0.002, fl.w) * step(r, fl.z) * to.a;
    col += to.rgb * front * 1.2;
    if (abs(float(id) - uTarget) < 0.5) {
      float rim = (1.0 - smoothstep(1.0, 15.0, e)) * smoothstep(0.7, 1.6, e);   // starts inside the border line
      col = mix(col * (1.0 + 0.45 * uPulse), vec3(1.0, 0.8, 0.3), 0.12 * uPulse);
      col = mix(col, vec3(1.0, 0.8, 0.3), rim * rim * (0.5 + 0.5 * uPulse));
    }
    // borders: dark, about a screen pixel or more either side of the line, never thinner than a region texel
    float fw = fwidth(e);
    float w = max(1.2 * fw, 0.9);
    col *= 1.0 - 0.82 * (1.0 - smoothstep(w, w + fw + 0.01, e));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
