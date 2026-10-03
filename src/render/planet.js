// Arrakis from space for the main menu (menu backdrop spec, revision 2). A planet shaded in code and lit from the
// left as in the Dune II intro — bright sand, rock and wind-drawn erg lines from 3D noise, a dim red night side —
// inside a thin, even blue rim of atmosphere; a small cratered moon whose soft shadow crosses the lit face; stars and
// a faint nebula. Its own scene and camera. update(dt, { dive }) flies the camera from the framing shot down to a
// landing site on the lit face on a logarithmic zoom, ever finer relief coming into view, into a haze of the
// battlefield's own fog colour: dive = 1 is the seam where the battle takes over; the emerge plays the path backwards.
// The opening (scenes/menu-intro.js) drives the camera itself with `travel`, an offset from the framing shot along
// which it drifts in and stops; the campaign's ending centres the planet and sweeps the victor's colour across it.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { FOG_COLOR } from './renderer.js';

const DEG = Math.PI / 180;
const FOV = 38;
const SPIN = 0.035, SPIN_REDUCED = 0.012;   // radians per second
const SPIN_STOP = 0.35;                      // the spin eases to a stop over this first share of the dive
const STARS = 2400;                          // inside the 1,000–3,000 particle budget
const ATMO_RADIUS = 1.1;                     // the rim's outer edge; the planet's radius is 1 (the intro's rim is ~8 % of it)
// World space is the framing camera's view space: it sits on +z and looks at the planet's centre.
const LIGHT = new THREE.Vector3(-0.85, 0.31, 0.42).normalize();   // towards the sun: from the left, the terminator a little right of centre
/** Towards the sun, world space (read only): what lights anything else in the planet scene, such as the opening's ships. */
export const PLANET_SUN = LIGHT;
// Wide screens: the planet, rim included, fills at most FILL of the height, sits LIFT (NDC) above centre, clear of
// the caption, and MARGIN (NDC) in from the right edge, MENU_GAP of the width clear of the menu column (7vw + 380px:
// menuShare gives its share of a window's width; without one, a typical 900px tall window is assumed).
const FILL = 0.8, FILL_MIN = 0.45, LIFT = 0.05, MARGIN = 0.05;
const MENU_VW = 0.07, MENU_PX = 380, MENU_GAP = 0.02;
const TALL = 0.5;                            // tall screens: the planet's disc spans half the width, centred
const STAR_SIZE = { min: 2, span: 3 };       // pixels: most stars at the minimum, a rare few up to min + span
const STAR_GLOW = { min: 0.45, span: 1.0 };  // brightness min + span · r^2.5: the brightest few bloom

/** At dive = 1, the seam with the battle, the camera is this high above the landing site, in planet radii, looking straight down. */
export const SEAM_ALTITUDE = 0.004;
const SITE = new THREE.Vector3(-0.34, -0.42, 0.84).normalize();   // the landing site: lit sand low on the left of the disc, away from the moon's pass
const TURN = 0.6;                            // by this share of the dive the view has turned to look straight down at the site
const HAZE_FROM = 0.3, HAZE_MAX = 0.97;      // the dust haze rises (in log-altitude) from this altitude to this much at the seam
const SPACE_FROM = 1.2, SPACE_TO = 0.35;     // altitudes between which the rim, stars, nebula and moon fade out as the planet fills the view

// The moon: tidally locked, on an orbit that brings it across the upper lit face while the planet phase runs (moon
// time 0–10 s) and keeps it high on the disc, away from the site, through the dive (10–14 s) and the emerge (-3.5–0 s).
const MOON_RADIUS = 0.09;
const MOON_ORBIT = 1.3;
const MOON_MID = 5;                          // moon time of mid-pass
const MOON_AT = new THREE.Vector3(-0.4, 0.4, 1.17).normalize();      // where it is then
const MOON_HEADING = new THREE.Vector3(1, -0.12, 0.5);               // and where it is going (made square to MOON_AT below)
MOON_HEADING.addScaledVector(MOON_AT, -MOON_HEADING.dot(MOON_AT)).normalize();
const MOON_SPEED = 0.042;                    // radians of orbit per second
const MOON_REDUCED = 0.35;                   // share of that speed under reduced motion
const CRATERS = 18;

const NOISE = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);   // quintic: no creases along the cells for the dive's close-ups to show
    return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.4); a *= 0.5; }
    return s;
  }
  vec3 grad3(vec3 p) {   // a hashed gradient; sine-free, so lattice coordinates in the tens of thousands stay random
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
  }
  // gradient noise, about -1..1, and its gradient (after Inigo Quilez): its zero set, unlike value noise's, does not
  // follow the lattice, and the analytic gradient shades relief without screen-space derivatives, which the sphere's
  // flat facets would break into a grid of lines up close
  vec4 gnoised(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    vec3 ga = grad3(i), gb = grad3(i + vec3(1.0, 0.0, 0.0)), gc = grad3(i + vec3(0.0, 1.0, 0.0)), gd = grad3(i + vec3(1.0, 1.0, 0.0));
    vec3 ge = grad3(i + vec3(0.0, 0.0, 1.0)), gf = grad3(i + vec3(1.0, 0.0, 1.0)), gg = grad3(i + vec3(0.0, 1.0, 1.0)), gh = grad3(i + vec3(1.0, 1.0, 1.0));
    float va = dot(ga, f), vb = dot(gb, f - vec3(1.0, 0.0, 0.0)), vc = dot(gc, f - vec3(0.0, 1.0, 0.0)), vd = dot(gd, f - vec3(1.0, 1.0, 0.0));
    float ve = dot(ge, f - vec3(0.0, 0.0, 1.0)), vf = dot(gf, f - vec3(1.0, 0.0, 1.0)), vg = dot(gg, f - vec3(0.0, 1.0, 1.0)), vh = dot(gh, f - vec3(1.0, 1.0, 1.0));
    float k0 = va, k1 = vb - va, k2 = vc - va, k3 = ve - va, k4 = va - vb - vc + vd, k5 = va - vc - ve + vg, k6 = va - vb - ve + vf;
    float k7 = -va + vb + vc - vd + ve - vf - vg + vh;
    vec3 g0 = ga, g1 = gb - ga, g2 = gc - ga, g3 = ge - ga, g4 = ga - gb - gc + gd, g5 = ga - gc - ge + gg, g6 = ga - gb - ge + gf;
    vec3 g7 = -ga + gb + gc - gd + ge - gf - gg + gh;
    float v = k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
    vec3 d = g0 + g1 * u.x + g2 * u.y + g3 * u.z + g4 * u.x * u.y + g5 * u.y * u.z + g6 * u.z * u.x + g7 * u.x * u.y * u.z
      + du * (vec3(k1, k2, k3) + u.yzx * vec3(k4, k5, k6) + u.zxy * vec3(k6, k4, k5) + k7 * u.yzx * u.zxy);
    return vec4(v, d);
  }`;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smootherstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (6 * t - 15) + 10); };

/** Unit vectors a → b along the great circle. */
function slerpUnit(a, b, t, out) {
  const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (angle < 1e-6) return out.copy(a).lerp(b, t).normalize();
  const s = Math.sin(angle);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * angle) / s).addScaledVector(b, Math.sin(t * angle) / s);
}

/**
 * The framing shot for an aspect ratio. The camera looks straight at the planet's centre from `distance` (planet
 * radii), so the disc stays round, and a lens shift (shiftX, shiftY, in NDC) moves it off centre. Wide screens: on
 * the right, clear of the menu, the whole planet and its rim inside the frame; tall screens: centred, half the
 * width. offsetX is the shift in planet radii at the planet's distance. menu: the menu column's share of the width.
 */
export function planetFraming(aspect, fov = FOV, menu = menuShare(900 * aspect)) {
  const t = Math.tan((fov / 2) * DEG);
  if (aspect < 1) return { distance: 1 / Math.sin(Math.atan(TALL * t * aspect)), shiftX: 0, shiftY: 0, offsetX: 0 };
  const room = 1 - menu - MENU_GAP - MARGIN / 2;   // the share of the width right of the menu
  const fill = Math.max(FILL_MIN, Math.min(FILL, room * aspect));
  const distance = ATMO_RADIUS / Math.sin(Math.atan(fill * t));
  const shiftX = 1 - MARGIN - fill / aspect;
  return { distance, shiftX, shiftY: LIFT, offsetX: shiftX * distance * t * aspect };
}

/** The main menu's column (7vw + 380px, menu.css) as a share of a window `width` pixels wide. */
export function menuShare(width) {
  return MENU_VW + MENU_PX / Math.max(1, width);
}

/** The camera's distance from the landing site in the framing shot. */
const startAltitude = (framing) => Math.hypot(SITE.x, SITE.y, framing.distance - SITE.z);

/** ln(start altitude / SEAM_ALTITUDE): the dive's log-zoom rate per unit of dive at dive = 1 (divide by the dive's duration for per second). */
export function diveRate(aspect = 16 / 9) {
  return Math.log(startAltitude(planetFraming(aspect)) / SEAM_ALTITUDE);
}

const _v0 = new THREE.Vector3(), _toCentre = new THREE.Vector3(), _toSite = new THREE.Vector3(), _moon = new THREE.Vector3();

/**
 * The camera at dive k for a framing. Its distance to the landing site falls as alt0 · exp(-rate · g(k)) with
 * g = 2k² - k³: easing in from the framing shot (g'(0) = 0), then a steady log-zoom (g'(1) = 1). Meanwhile it swings
 * round the site to straight above it and turns from the planet's centre to the site, both done by k = TURN, while
 * the lens shift eases out. The horizon stays level (world up), so there is no roll.
 */
function divePose(k, framing, pose) {
  const alt0 = startAltitude(framing);
  const rate = Math.log(alt0 / SEAM_ALTITUDE);
  const altitude = alt0 * Math.exp(-rate * (2 * k * k - k * k * k));
  const w = smootherstep(0, TURN, k);
  _v0.set(-SITE.x, -SITE.y, framing.distance - SITE.z).divideScalar(alt0);
  const away = slerpUnit(_v0, SITE, w, pose.away);   // from the site towards the camera
  pose.position.copy(SITE).addScaledVector(away, altitude);
  _toCentre.copy(pose.position).negate().normalize();
  _toSite.copy(away).negate();
  slerpUnit(_toCentre, _toSite, w, pose.forward);
  pose.altitude = altitude;
  pose.shiftX = framing.shiftX * (1 - w);
  pose.shiftY = framing.shiftY * (1 - w);
  return pose;
}

/** The moon's centre (world) at moon time t: a circular orbit through MOON_AT at MOON_MID. */
function moonAt(t, out) {
  const a = MOON_SPEED * (t - MOON_MID);
  return out.copy(MOON_AT).multiplyScalar(Math.cos(a)).addScaledVector(MOON_HEADING, Math.sin(a)).multiplyScalar(MOON_ORBIT);
}

function planetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: LIGHT.clone() },
      uMoon: { value: new THREE.Vector4(0, 0, -1000, MOON_RADIUS) },
      uHaze: { value: 0 },
      uFog: { value: new THREE.Color(FOG_COLOR) },   // linear, as the renderer converts scene.fog's colour
      uView: { value: 1 },
      uTint: { value: new THREE.Vector4(0, 0, 0, 0) },   // the ending: the victor's colour (linear) and how far it has spread
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vPos;
      void main() {
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;    // towards the sun, view space
      uniform vec4 uMoon;     // the moon's centre (view space) and radius, for its shadow
      uniform float uHaze;    // the dive's dust haze, 0..1
      uniform vec3 uFog;      // the battlefield's fog colour
      uniform float uView;    // log2 of the view's height at the ground, planet radii: finer octaves fade in as it shrinks
      uniform vec4 uTint;     // the ending's shimmer: the victor's colour and its spread, 0..1 (0: none)
      uniform float uTime;
      uniform mat3 normalMatrix;
      varying vec3 vObj;      // the point on the unit sphere, before the planet's spin and tilt
      varying vec3 vPos;      // view space
      // palette, in linear light before the grade and ACES: the intro's bright sand, deeper sand, rock
      const vec3 SAND = vec3(0.70, 0.30, 0.105);
      const vec3 SAND_DEEP = vec3(0.50, 0.19, 0.062);
      const vec3 ROCK = vec3(0.26, 0.095, 0.035);
      const vec3 NIGHT = vec3(0.085, 0.004, 0.003);  // the night side's dim red, as a share of the albedo
      const vec3 DUSK = vec3(1.0, 0.45, 0.08);       // the sun's colour low over the terminator
      const float RELIEF = 0.2;                      // how ragged high and low ground make the terminator
      const float SUN_TAN = 0.09;                    // the sun's apparent radius: the moon's shadow softens with distance
      const float SHADE = 0.85;                      // share of the sunlight the moon's umbra takes
      const float RIM_POWER = 5.0;                   // how tight to the limb the planet's own pale edge stays
      const vec3 RIM_TINT = vec3(0.15, 0.5, 0.42);   // the intro's pale cyan line along the limb (the atmosphere's LINE)
      const float FINE_FROM = 64.0;                  // the first finer octave (below a pixel in the framing shot); nine more double it
      const float FINE_GAIN = 0.2;                   // their colour contrast
      const float FINE_PX = 7.0;                     // an octave is in once its features span 1/64 of the view, out at 1/128
      const float BUMP = 0.06;                       // their relief: height per wavelength
      const float CREST = 0.14, CREST_SOFT = 0.004;  // the noise level the ridges follow, and how rounded they are (squared)
      const float BUMP_LIGHT = 1.6;                  // how strongly the relief shades
      const mat3 TURN_OCTAVE = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
      ${NOISE}
      float moonShadow(vec3 q) {
        vec3 m = uMoon.xyz - q;
        float s = dot(m, uLight);                    // how far towards the sun the moon lies
        if (s <= 0.0) return 1.0;
        float d = length(m - s * uLight);            // how far the ray to the sun passes from the moon's centre
        float r = uMoon.w, pen = 0.004 + s * SUN_TAN;
        float cover = 1.0 - smoothstep(r - pen, r + pen, d);
        return 1.0 - SHADE * cover * min(1.0, r * r / (pen * pen));   // far behind a small moon: a dimmer, wider shadow
      }
      // Detail that keeps coming as the view shrinks: ridged octaves, each faded in once it spans enough pixels. Their
      // heights (ridge² / frequency) scale with their wavelengths, so the relief shades alike at every zoom and the dive
      // never goes soft. Returns the colour variation; slope is the heights' gradient (object space).
      float fine(vec3 p, out vec3 slope) {
        float a = 0.0, f = FINE_FROM;
        vec3 g = vec3(0.0);
        mat3 m = TURN_OCTAVE * FINE_FROM;   // this octave's lattice position is m p
        for (int i = 0; i < 10; i++) {
          // in once its features span 1/64 of the view; out again, to save work, once they are wider than it (a mere
          // tilt then, and only deep in the haze)
          float w = clamp(FINE_PX - log2(f) - uView, 0.0, 1.0) * clamp(1.0 + log2(f) + uView, 0.0, 1.0);
          if (w > 0.0) {
            // crests along a level set of the noise, softened: its zero set runs through every lattice point, and
            // creases there would join up into a grid of cells
            vec4 n = gnoised(m * p);
            float c = n.x - CREST, s = sqrt(c * c + CREST_SOFT), ridge = 1.0 - s;
            a += w * n.x;
            g += (w * -2.0 * ridge * (c / s) / f) * (n.yzw * m);   // v * m is m-transposed times v
          }
          m = TURN_OCTAVE * m * 2.0;
          f *= 2.0;
        }
        slope = g;
        return a;
      }
      void main() {
        vec3 p = normalize(vObj);
        float base = fbm(p * 2.2);
        float warp = fbm(p * 5.0 + base * 3.0);
        // the intro's wind-drawn swirls: contour lines of a smooth field, drawn out along the latitudes and bent by the
        // coarser noise, faded where they crowd below a pixel
        vec3 col = mix(SAND_DEEP, SAND, smoothstep(0.3, 0.62, base + 0.25 * (warp - 0.5)));
        if (uView > -2.0) {   // a planet-sized pattern: gone before the close-up could show it as cracks
          vec3 wind = p * vec3(2.6, 5.5, 2.6) + vec3(warp * 1.6, base * 2.2, 0.0);
          float erg = (0.65 * vnoise(wind) + 0.35 * vnoise(wind * 2.1 + 5.3)) * 7.0;
          float fw = fwidth(erg);
          float line = (1.0 - smoothstep(0.0, 0.1 + fw, abs(fract(erg + 0.5) - 0.5))) * (1.0 - smoothstep(0.15, 0.4, fw));
          col *= 1.0 + (0.075 * line - 0.03) * smoothstep(-2.0, -0.5, uView);
        }
        col = mix(col, ROCK, smoothstep(0.62, 0.74, fbm(p * 3.5 + 3.1)) * 0.55);
        // the ending (the Sega's "planet shimmer"): the victor's colour sweeps across the face from the lit limb on a
        // ragged front that sparkles as it passes, keeping the sand's light and dark
        float glint = 0.0;
        if (uTint.w > 0.0) {
          float s = -normalize(normalMatrix * p).x + 0.35 * (warp - 0.5) + 0.2 * (base - 0.5);
          float front = 1.35 - 2.85 * uTint.w;
          float lum = dot(col, vec3(0.3, 0.55, 0.15)) / dot(SAND, vec3(0.3, 0.55, 0.15));
          col = mix(col, uTint.rgb * (0.3 + 0.8 * lum), smoothstep(front - 0.07, front + 0.07, s));
          glint = (1.0 - smoothstep(0.0, 0.12, abs(s - front))) * step(0.84, hash3(floor(p * 150.0) + floor(uTime * 12.0)));
        }
        vec3 slope;
        col *= 1.0 + FINE_GAIN * fine(p, slope);
        // normals from the true sphere, not the interpolated vertex normals: those bend at every facet edge, which the
        // close-up would show as a grid of Mach bands in the shading
        vec3 n = normalize(normalMatrix * p), v = normalize(-vPos);
        float ndl = dot(n, uLight);
        vec3 tilted = normalize(normalMatrix * (p - BUMP * (slope - dot(slope, p) * p)));   // the relief's normal, view space
        float shade = 1.0 + BUMP_LIGHT * (dot(tilted, uLight) - ndl);
        float light = smoothstep(-0.12, 0.65, ndl + RELIEF * (warp - 0.5)) * clamp(shade, 0.25, 1.75);
        vec3 sun = mix(DUSK, vec3(1.0), smoothstep(0.1, 0.8, light));   // a low sun reddens; the moon's shadow only dims
        col = col * (NIGHT + light * moonShadow(vPos) * sun);
        col += glint * (uTint.rgb + 0.35) * (0.6 + light);
        float rim = pow(1.0 - max(dot(n, v), 0.0), RIM_POWER);
        col = mix(col, RIM_TINT, rim * smoothstep(-0.2, 0.5, ndl));   // mixed, not added: over red sand, added blue turns pink
        gl_FragColor = vec4(mix(col, uFog, uHaze), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT.clone() }, uCentre: { value: new THREE.Vector3() }, uFade: { value: 1 } },
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      uniform vec3 uCentre;   // the planet's centre, view space
      uniform float uFade;
      varying vec3 vNormal;
      varying vec3 vPos;
      const float R = ${ATMO_RADIUS.toFixed(3)};
      // colours matched to the intro through the grade and ACES: its periwinkle body, a light blue towards the lit
      // limb (BLUE + CYAN there: less red, more green) and, hard against the limb all round, a pale cyan line
      const vec3 BLUE = vec3(0.12, 0.19, 1.0);
      const vec3 CYAN = vec3(-0.085, 0.13, 0.1);
      const vec3 LINE = vec3(0.15, 0.5, 0.42);
      const float LINE_WIDTH = 0.12;              // of the rim's height
      const float DARK = 0.5;                     // the night side keeps this share of the glow
      const float FALL = 1.15, FALL_DARK = 1.9;   // how fast it fades outwards: the night side's rim is thinner
      const float EDGE = 0.07;                    // left at the outline: the intro's rim ends crisply rather than fading out
      const float GAIN = 1.0;
      void main() {
        // back face: -n.v runs from 0 at the shell's outline to sqrt(1 - 1/R^2) where the line of sight grazes the
        // planet, whatever the perspective; from it, how high above the limb the line of sight passes
        float c = -dot(normalize(vNormal), normalize(-vPos));
        float b = R * sqrt(max(0.0, 1.0 - c * c));
        float h = clamp((b - 1.0) / (R - 1.0), 0.0, 1.0);   // 0 at the limb, 1 at the outline
        vec3 ray = normalize(vPos);
        vec3 over = ray * dot(uCentre, ray) - uCentre;      // from the centre to where the line of sight passes closest
        float side = smoothstep(-0.4, 0.5, dot(normalize(over), uLight));
        float body = mix(EDGE, 1.0, pow(1.0 - h, mix(FALL_DARK, FALL, side)));
        vec3 col = BLUE * body + CYAN * pow(1.0 - h, 4.0) * side;
        col = mix(col, LINE, (1.0 - smoothstep(0.0, LINE_WIDTH, h)) * mix(0.55, 0.8, side));
        float outline = 1.0 - smoothstep(1.0 - 1.5 * fwidth(h), 1.0, h);   // the crisp edge, antialiased
        gl_FragColor = vec4(col * mix(DARK, 1.0, side) * GAIN * outline * uFade, 1.0);
      }`,
  });
}

function moonMaterial(rng) {
  const craters = [];
  for (let i = 0; i < CRATERS; i++) {
    const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    const r = i < 3 ? rng.range(0.3, 0.45) : rng.range(0.07, 0.17) * (i % 3 ? 1 : 1.6);   // a few old basins, many small craters
    craters.push(new THREE.Vector4(Math.cos(a) * s, u, Math.sin(a) * s, r));
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: LIGHT.clone() }, uPlanet: { value: new THREE.Vector3() }, uFade: { value: 1 }, uCraters: { value: craters },
    },
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      uniform vec3 uPlanet;   // the planet's centre, view space: the moon can pass through its shadow
      uniform float uFade;
      uniform vec4 uCraters[${CRATERS}];   // object-space centre and radius (radians)
      uniform mat3 normalMatrix;
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vPos;
      const vec3 HIGHLAND = vec3(0.36, 0.345, 0.325);   // a light, faintly warm grey against the sand and the black
      const vec3 MARE = vec3(0.2, 0.195, 0.188);
      const float KEY = 1.2, AMBIENT = 0.01;
      const float DEPTH = 0.3;                          // how steep the crater walls shade
      ${NOISE}
      float planetShadow(vec3 q) {
        vec3 m = uPlanet - q;
        float s = dot(m, uLight);
        if (s <= 0.0) return 1.0;
        return smoothstep(0.96, 1.06, length(m - s * uLight));   // softened by the planet's atmosphere
      }
      // one crater's slope and tone at d crater radii from its centre, away pointing from it along the ground: the bowl's
      // wall rises to a sharp rim (the normal tilts inwards), the ejecta outside falls away and is a little brighter
      void crater(vec3 away, float d, float depth, inout vec3 bump, inout float tone) {
        if (d > 1.6) return;
        float wall = d < 1.0 ? -smoothstep(0.0, 1.0, d) : 0.55 * (1.0 - smoothstep(1.0, 1.6, d));
        bump += away / max(length(away), 1e-5) * wall * depth;
        tone *= 1.0 - 0.08 * (1.0 - smoothstep(0.5, 0.95, d)) + 0.12 * smoothstep(0.85, 1.0, d) * (1.0 - smoothstep(1.0, 1.35, d));
      }
      void main() {
        vec3 p = normalize(vObj);
        vec3 bump = vec3(0.0);
        float tone = 1.0;
        for (int i = 0; i < ${CRATERS}; i++) {   // the named craters, large basins shallower
          vec3 c = uCraters[i].xyz;
          if (dot(p, c) > 0.0) crater(p - c * dot(p, c), length(p - c * dot(p, c)) / uCraters[i].w, DEPTH * mix(1.0, 0.45, smoothstep(0.15, 0.4, uCraters[i].w)), bump, tone);
        }
        // and many small ones: one per cell of a lattice, at a hashed spot with a hashed size
        vec3 q = p * 7.0, cell = floor(q);
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 at = cell + vec3(float(x), float(y), float(z)), h = grad3(at) * 0.5 + 0.5;
          vec3 off = q - at - h;
          crater(off - p * dot(off, p), length(off) / (0.14 + 0.2 * h.x * h.y), DEPTH, bump, tone);
        }
        vec3 col = mix(MARE, HIGHLAND, smoothstep(0.42, 0.58, fbm(p * 1.8 + 4.0))) * tone * (0.86 + 0.28 * fbm(p * 11.0));
        vec3 n = normalize(normalize(vNormal) + normalMatrix * bump);
        float light = clamp(dot(n, uLight) * 1.1 + 0.04, 0.0, 1.0) * planetShadow(vPos);   // unsaturated, so slopes show all over
        gl_FragColor = vec4(col * (AMBIENT + KEY * light), uFade);
      }`,
  });
}

function starField(rng) {
  const pos = new Float32Array(STARS * 3), size = new Float32Array(STARS), tone = new Float32Array(STARS * 3), phase = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 900, u * 900, Math.sin(a) * s * 900], i * 3);
    size[i] = STAR_SIZE.min + Math.pow(rng.next(), 6) * STAR_SIZE.span;
    const warm = rng.next(), b = STAR_GLOW.min + STAR_GLOW.span * Math.pow(rng.next(), 2.5);
    tone.set([b * (0.85 + 0.15 * warm), b * 0.92, b * (1.05 - 0.2 * warm)], i * 3);
    phase[i] = rng.next();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 }, uPixelRatio: { value: 1 }, uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aTone;
      attribute float aPhase;
      uniform float uTime;
      uniform float uTwinkle;
      uniform float uPixelRatio;
      uniform float uFade;
      varying vec3 vTone;
      void main() {
        vTone = aTone * uFade * (1.0 - uTwinkle * 0.3 * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 1.8) + aPhase * 6.2832)));
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTone;
      // the fade across the sprite (0.5 is its edge): a flat core, so a 2-pixel star keeps its pixels lit
      const float CORE = 0.25, EDGE = 0.6;
      void main() {
        float a = 1.0 - smoothstep(CORE, EDGE, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vTone * a, 1.0);
      }`,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return points;
}

function nebula() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec2 vUv;
      const vec3 TINT = vec3(0.05, 0.14, 0.42);   // deep blue
      const float GAIN = 2.0;                      // how strongly the wisps show
      ${NOISE}
      void main() {
        float fall = 1.0 - smoothstep(0.05, 0.5, length((vUv - 0.5) * vec2(1.0, 1.4)));
        float wisps = smoothstep(0.42, 0.8, fbm(vec3(vUv * 3.5, 1.7))) * fall;
        gl_FragColor = vec4(TINT * wisps * GAIN * uFade, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(620, 440), m);
  mesh.position.set(-150, -110, -690);   // round the planet's lower-left limb, as in the intro
  return mesh;
}

export class PlanetShot {
  constructor({ seed = 1 } = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.02, 2000);
    this.aspect = 0;
    this.menu = 0;
    this.framing = planetFraming(16 / 9);
    this.time = 0;
    this.moonTime = 0;
    this.pose = { position: new THREE.Vector3(), forward: new THREE.Vector3(), away: new THREE.Vector3(), altitude: 0, shiftX: 0, shiftY: 0 };
    this.light = new THREE.Vector3();
    this.centre = new THREE.Vector3();
    this.altitude = startAltitude(this.framing);
    this.haze = 0;   // the dust haze's share of the picture after update(): 0 in space, 0.97 at the seam
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.32;
    this.spin = new THREE.Group();
    this.spin.rotation.y = new Rng(seed).range(0, Math.PI * 2);   // another face of Arrakis every visit
    this.surface = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), planetMaterial());
    this.spin.add(this.surface);
    tilt.add(this.spin);
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(ATMO_RADIUS, 96, 64), atmosphereMaterial());   // not spun: the glow follows the light
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 48, 32), moonMaterial(new Rng(1234)));   // the same moon every visit
    this.stars = starField(new Rng(seed * 7 + 3));
    this.nebula = nebula();
    this.scene.add(tilt, this.atmosphere, this.moon, this.stars, this.nebula);
    this.layers = [];   // more of space, such as the opening's near stars and dust (render/space-travel.js)
    this.tint = new THREE.Color();
    this.update(0);
  }

  /** Adds a layer of space: its `group` joins the scene, and update({ fade, nebula, time, pixelRatio, reduced }) runs every frame, fade fading it with the rest of space. */
  attach(layer) {
    this.layers.push(layer);
    this.scene.add(layer.group);
    return layer;
  }

  /** Moon time t0 now: 0 is the start of the planet phase, when its pass across the lit face begins. */
  startPass(t0 = 0) {
    this.moonTime = t0;
  }

  /** d ln(altitude) / d dive at dive = 1 for the current framing: the zoom rate at the seam, per unit of dive. */
  diveRate() {
    return Math.log(startAltitude(this.framing) / SEAM_ALTITUDE);
  }

  /**
   * dive 0..1: 0 is the framing shot, 1 the seam (the camera SEAM_ALTITUDE above the landing site, looking straight
   * down into the haze); aspect frames the planet, and menu (the menu column's share of the width, menuShare) keeps
   * it clear of the menu; reduced slows the turn, the moon and stills the stars; pixelRatio keeps star size on
   * high-DPI screens. Afterwards `altitude` is the camera's distance from the landing site.
   * The opening and the ending drive the camera themselves: travel { x, y, z } moves it that far from the framing shot,
   * looking the same way (straight along -z), and replaces the dive; centred 0..1 takes the lens shift out, so the
   * planet sits in the middle; tint { color, amount } sweeps a colour across the planet (color: hex or THREE.Color);
   * nebula 0..1 shows that share of the nebulae (the opening's empty stars have none until the planet comes).
   */
  update(dt, { dive = 0, aspect = 16 / 9, menu = menuShare(900 * aspect), reduced = false, pixelRatio = 1, travel = null, centred = 0, tint = null, nebula = 1 } = {}) {
    const k = travel ? 0 : clamp01(dive);
    this.time += dt;
    this.moonTime += dt * (reduced ? MOON_REDUCED : 1);
    this.spin.rotation.y += dt * (reduced ? SPIN_REDUCED : SPIN) * (1 - smoothstep(0, SPIN_STOP, k));   // still by the time the ground is close
    if (aspect !== this.aspect || menu !== this.menu) {
      this.aspect = aspect;
      this.menu = menu;
      this.framing = planetFraming(aspect, FOV, menu);
    }
    const pose = divePose(k, this.framing, this.pose);
    if (travel) {   // at no offset this is exactly the dive's first pose: the framing shot
      pose.position.x += travel.x ?? 0;
      pose.position.y += travel.y ?? 0;
      pose.position.z += travel.z ?? 0;
      pose.altitude = pose.position.distanceTo(SITE);
    }
    if (centred) { pose.shiftX *= 1 - clamp01(centred); pose.shiftY *= 1 - clamp01(centred); }
    this.altitude = pose.altitude;

    const cam = this.camera;
    cam.position.copy(pose.position);
    cam.lookAt(pose.position.x + pose.forward.x, pose.position.y + pose.forward.y, pose.position.z + pose.forward.z);
    cam.aspect = aspect;
    cam.near = Math.min(0.05, Math.max(1e-5, 0.4 * (pose.position.length() - 1)));   // the ground is never nearer than the height above it
    // the lens shift, in NDC (setViewOffset's units are free, but its full width : height sets the aspect)
    cam.setViewOffset(2 * aspect, 2, -pose.shiftX * aspect, pose.shiftY, 2 * aspect, 2);
    cam.updateMatrixWorld();
    const view = cam.matrixWorldInverse;

    moonAt(this.moonTime, this.moon.position);
    this.moon.lookAt(0, 0, 0);   // tidally locked
    this.moon.updateMatrixWorld();
    const space = smoothstep(Math.log(SPACE_TO), Math.log(SPACE_FROM), Math.log(pose.altitude));
    const haze = (this.haze = HAZE_MAX * smoothstep(Math.log(HAZE_FROM), Math.log(SEAM_ALTITUDE), Math.log(pose.altitude)));
    const light = this.light.copy(LIGHT).transformDirection(view);
    const centre = this.centre.set(0, 0, 0).applyMatrix4(view);

    const pu = this.surface.material.uniforms;
    pu.uLight.value.copy(light);
    const m = _moon.copy(this.moon.position).applyMatrix4(view);
    pu.uMoon.value.set(m.x, m.y, m.z, MOON_RADIUS);
    pu.uHaze.value = haze;
    pu.uView.value = Math.log2(2 * pose.altitude * Math.tan((FOV / 2) * DEG));
    pu.uTime.value = this.time;
    if (tint && tint.amount > 0) { this.tint.set(tint.color); pu.uTint.value.set(this.tint.r, this.tint.g, this.tint.b, clamp01(tint.amount)); }
    else pu.uTint.value.w = 0;
    const au = this.atmosphere.material.uniforms;
    au.uLight.value.copy(light);
    au.uCentre.value.copy(centre);
    au.uFade.value = space;
    const mu = this.moon.material.uniforms;
    mu.uLight.value.copy(light);
    mu.uPlanet.value.copy(centre);
    mu.uFade.value = space;
    this.nebula.material.uniforms.uFade.value = space * nebula;
    const su = this.stars.material.uniforms;
    su.uTime.value = this.time;
    su.uTwinkle.value = reduced ? 0 : 1;
    su.uPixelRatio.value = pixelRatio;
    su.uFade.value = space;
    this.atmosphere.visible = this.moon.visible = this.stars.visible = space > 0.001;
    this.nebula.visible = space * nebula > 0.001;
    for (const layer of this.layers) layer.update({ fade: space, nebula, time: this.time, pixelRatio, reduced });
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
}
