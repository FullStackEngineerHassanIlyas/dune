// Terrain shading injected into MeshStandardMaterial so PBR lighting and shadows still apply
// (spec §5.2): sand with wind ripples, lit dune crests, cracked rock, banded mountains, speckled
// spice that follows the live spice texture, concrete slabs with seams, decals (whose darkness also
// shades craters and tread marks as hollows) and soft shroud.
const HEAD = /* glsl */ `
uniform sampler2D uSpice;
uniform sampler2D uConcrete;
uniform sampler2D uShroud;
uniform sampler2D uDecals;
uniform sampler2D uRockTex;
uniform vec2 uMapSize;
uniform float uTime;
uniform vec2 uApron;   // the apron's albedo and brightness against the map's: darker in a game, the same in the menu's battle
varying vec3 vTerrain;
varying vec3 vWorldPos;

float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tFbm(vec2 p) { return 0.5 * tNoise(p) + 0.25 * tNoise(p * 2.03 + 7.1) + 0.125 * tNoise(p * 4.07 + 3.3); }
float ripple(vec2 p) { return sin(dot(p, vec2(0.86, 0.5)) * 11.0 + tNoise(p * 1.3) * 5.0); }

vec3 terrainAlbedo(vec2 p, inout float rough, inout float spiceAmt) {
  vec3 sand = mix(vec3(0.80, 0.60, 0.36), vec3(0.92, 0.74, 0.47), tFbm(p * 0.45));
  sand *= 0.94 + 0.1 * tNoise(p * 7.0);
  sand *= 1.0 + 0.14 * vTerrain.z * clamp(vWorldPos.y * 3.0, 0.0, 1.0);
  vec3 rock = mix(vec3(0.45, 0.37, 0.28), vec3(0.62, 0.52, 0.40), tFbm(p * 0.7));
  rock *= 0.9 + 0.16 * tFbm(p * 1.6 + 3.0);
  // grain, pebbles, craters and cracks; a second rotated sample hides the texture repeat
  rock *= texture2D(uRockTex, p * 0.29).r * texture2D(uRockTex, vec2(p.y, -p.x) * 0.113 + 0.31).r * 3.3;
  vec3 mtn = mix(vec3(0.27, 0.21, 0.17), vec3(0.45, 0.35, 0.27), tFbm(p * vec2(0.6, 2.4)));
  mtn *= 0.93 + 0.07 * sin(vWorldPos.y * 9.0 + tFbm(p * 0.7) * 5.0);
  mtn *= texture2D(uRockTex, p * 0.45 + 0.37).r * 1.8;
  vec3 col = mix(sand, rock, vTerrain.x);
  col = mix(col, mtn, vTerrain.y);
  rough = mix(0.97, 0.88, vTerrain.x);
#ifndef APRON
  vec2 uv = p / uMapSize;
  float s = texture2D(uSpice, uv).r;
  float edge = s + (tFbm(p * 1.7) - 0.5) * 0.3;
  spiceAmt = smoothstep(0.18, 0.34, edge) * (1.0 - vTerrain.x);
  vec3 spice = mix(vec3(0.80, 0.43, 0.22), vec3(0.64, 0.26, 0.12), smoothstep(0.55, 0.95, s));
  spice *= 0.9 + 0.2 * tNoise(p * 9.0);
  spice = mix(spice, vec3(0.95, 0.66, 0.42), step(0.88, tNoise(p * 16.0)) * 0.55);
  col = mix(col, spice, spiceAmt);
  float concrete = texture2D(uConcrete, (floor(p) + 0.5) / uMapSize).r;
  if (concrete > 0.5) {   // Genesis slabs: dark olive plates, bevel lit on the north-west, shaded on the south-east
    vec2 f = fract(p);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float rim = 1.0 - smoothstep(0.035, 0.075, edge);
    float seam = 1.0 - smoothstep(0.0, 0.018, edge);
    float lit = step(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y));
    vec3 plate = vec3(0.34, 0.35, 0.21) * (0.9 + 0.14 * tNoise(p * 6.0));
    vec3 bevel = mix(vec3(0.22, 0.22, 0.13), vec3(0.60, 0.60, 0.46), lit);
    col = mix(mix(plate, bevel, rim), vec3(0.12, 0.12, 0.07), seam);
    rough = 0.8;
  }
#endif
  col = pow(col, vec3(2.2));   // the colours above are authored in sRGB; lighting works in linear
#ifndef APRON
  col *= texture2D(uDecals, p / uMapSize).rgb;
#else
  col *= uApron.x;
#endif
  return col;
}

vec3 perturbTerrainNormal(vec3 n, vec2 p, float spiceAmt) {
  float e = 0.02;
  float amt = 0.012 * (1.0 - vTerrain.x) * (1.0 - vTerrain.y) * (1.0 - 0.6 * spiceAmt);
  float hx = ripple(p + vec2(e, 0.0)) - ripple(p - vec2(e, 0.0));
  float hz = ripple(p + vec2(0.0, e)) - ripple(p - vec2(0.0, e));
  vec3 d = vec3(-hx, 0.0, -hz) / (2.0 * e) * amt;
  float r = vTerrain.x * 0.05;
  float bx = tNoise((p + vec2(e, 0.0)) * 3.0) - tNoise((p - vec2(e, 0.0)) * 3.0);
  float bz = tNoise((p + vec2(0.0, e)) * 3.0) - tNoise((p - vec2(0.0, e)) * 3.0);
  d += vec3(-bx, 0.0, -bz) / (2.0 * e) * r;
#ifndef APRON
  // the decal map's darkness read as depth: craters are bowls and tread marks grooves that catch the light
  vec2 uv = p / uMapSize, du = vec2(0.045) / uMapSize;
  float h0 = dot(texture2D(uDecals, uv).rgb, vec3(0.333));
  float dhx = dot(texture2D(uDecals, uv + vec2(du.x, 0.0)).rgb, vec3(0.333)) - h0;
  float dhz = dot(texture2D(uDecals, uv + vec2(0.0, du.y)).rgb, vec3(0.333)) - h0;
  d += vec3(-dhx, 0.0, -dhz) * (0.05 / 0.045);
#endif
  return normalize(n + mat3(viewMatrix) * d);
}

float terrainShroud(vec2 p) {
  float n = (tNoise(p * 2.5) - 0.5) * 0.25;
#ifdef APRON
  // Off the map the apron takes the shroud of the nearest edge tiles. Taken as it is, the line between an
  // explored and an unexplored edge tile would run on to the horizon as a hard black curtain, so the
  // farther out a point lies, the wider the stretch of edge it averages.
  vec2 edge = clamp(p, vec2(0.0), uMapSize);
  float r = length(p - edge) * 0.55;
  float e = 0.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) e += texture2D(uShroud, clamp((edge + vec2(i, j) * r * 0.5) / uMapSize, 0.0, 1.0)).r;
  return smoothstep(0.2, 0.8, e / 25.0 + n) * uApron.y;
#else
  vec2 sh = texture2D(uShroud, clamp(p / uMapSize, 0.0, 1.0)).rg;
  float explored = smoothstep(0.2, 0.8, sh.r + n);
  float visible = smoothstep(0.2, 0.8, sh.g + n);
  return explored * mix(0.62, 1.0, visible);
#endif
}
`;

export function injectTerrainShader(material, uniforms, { apron = false } = {}) {
  if (apron) material.defines = { ...(material.defines ?? {}), APRON: 1 };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTerrain;\nvarying vec3 vTerrain;\nvarying vec3 vWorldPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain = aTerrain;\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <map_fragment>', 'float tRough = 0.95;\nfloat tSpice = 0.0;\ndiffuseColor.rgb = terrainAlbedo(vWorldPos.xz, tRough, tSpice);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturbTerrainNormal(normal, vWorldPos.xz, tSpice);')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= terrainShroud(vWorldPos.xz);\n#include <dithering_fragment>');
  };
  material.customProgramCacheKey = () => (apron ? 'terrain-apron' : 'terrain');
  return material;
}
