// The three Mentats as our own SVG drawings, after the descriptions in research.md §4 (no original artwork):
// Cyril of the Atreides, young and calm, swept-back blond hair, blue eyes, a high-collared navy cloak with a round
// pendant and a red book in hand; Radnor of the Harkonnen, bald, heavy dark brows and a sly smirk, hands clasped,
// a dark red-brown robe, close up; Ammon of the Ordos, slim and narrow-faced, swept-back dark-brown hair, a dark
// green robe over a teal collar, a pendant and a hand at his chest. Lit from the left, as the Sega screens are.
// Each returns markup for innerHTML (a string, so it builds in Node too); ids carry the house, so they stay unique.

const svg = (id, label, body) => `<svg class="cp-mentat-art" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" preserveAspectRatio="xMidYMax meet">${body}</svg>`;
const lin = (id, stops, x2 = 1, y2 = 0, x1 = 0, y1 = 0) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/** An almond eye with its iris clipped inside, the upper lid line, a crease and (optionally) a heavy lid. */
function eye(p, side, cx, cy, { w = 18, open = 11, iris = '#3a78c8', lid = '#2b170e', crease = 'rgba(80,40,20,.45)', look = 1, heavy = 0, bag = 0 }) {
  const id = `${p}-eye${side}`;
  const top = `M${cx - w} ${cy + 1} Q${cx - 2} ${cy - open} ${cx + w} ${cy + 1}`;
  const shape = `${top} Q${cx} ${cy + open * 0.55} ${cx - w} ${cy + 1}Z`;
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="#f1e7d6"/>
    <g clip-path="url(#${id})"><circle cx="${cx + look}" cy="${cy + 1}" r="${open * 0.78}" fill="${iris}" stroke="rgba(10,10,20,.55)" stroke-width="1.5"/><circle cx="${cx + look}" cy="${cy + 1}" r="${open * 0.36}" fill="#120a06"/>
      <circle cx="${cx + look - 2.5}" cy="${cy - 2.5}" r="1.8" fill="#fff" opacity=".9"/><path d="${top} L${cx + w} ${cy - 14} L${cx - w} ${cy - 14}Z" fill="rgba(60,30,15,.3)" transform="translate(0 ${2.5 + heavy * 1.2})"/></g>
    <path d="M${cx - w + 4} ${cy + 3} Q${cx} ${cy + open * 0.62} ${cx + w - 2} ${cy + 2}" fill="none" stroke="rgba(90,45,25,.45)" stroke-width="1.4"/>
    <path d="${top}" fill="none" stroke="${lid}" stroke-width="${3.2 + heavy * 0.6}" stroke-linecap="round"/>
    <path d="M${cx - w + 3} ${cy - open + 1 - heavy * 0.4} Q${cx} ${cy - open - 6 + heavy} ${cx + w - 2} ${cy - open + 3 - heavy * 0.3}" fill="none" stroke="${crease}" stroke-width="${1.6 + heavy * 0.5}"/>
    ${bag ? `<path d="M${cx - w + 4} ${cy + open * 0.6 + 2} Q${cx} ${cy + open + 4} ${cx + w - 3} ${cy + open * 0.5 + 2}" fill="none" stroke="rgba(70,35,20,.4)" stroke-width="1.6"/>` : ''}`;
}

/** The nose: a shadow down its right side, a lit bridge, the tip and two nostrils. */
function nose(x, top, tip, { w = 14, shade = 'rgba(95,50,28,.55)' } = {}) {
  return `<path d="M${x + 3} ${top} C${x + 6} ${top + (tip - top) * 0.5} ${x + w * 0.75} ${tip - 10} ${x + w * 0.8} ${tip - 2} C${x + w * 0.5} ${tip + 6} ${x - 2} ${tip + 6} ${x - w * 0.55} ${tip + 1}" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${x - 2} ${top + 4} C${x - 3} ${top + 24} ${x - 4} ${tip - 16} ${x - 6} ${tip - 6}" fill="none" stroke="rgba(255,236,210,.35)" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="${x - w * 0.42}" cy="${tip + 1}" rx="4" ry="2.2" fill="rgba(60,25,12,.75)"/><ellipse cx="${x + w * 0.42}" cy="${tip + 1}" rx="4" ry="2.2" fill="rgba(60,25,12,.85)"/>`;
}

/** The face's shadow side (light from the left), clipped to the face. */
const shade = (clip, d, colour) => `<g clip-path="url(#${clip})"><path d="${d}" fill="${colour}"/></g>`;

function cyril() {
  const p = 'm-atreides';
  const face = 'M140 168 C138 224 152 266 178 290 C190 300 210 301 222 291 C250 267 263 224 261 168 C259 114 232 88 200 88 C168 88 142 114 140 168Z';
  return svg(p, 'Cyril, Mentat of House Atreides', `<defs>
    ${lin(`${p}-skin`, [[0, '#f6cfa8'], [0.5, '#e2aa80'], [1, '#a8693f']])}
    ${lin(`${p}-hair`, [[0, '#fff6c0'], [0.45, '#efcb58'], [1, '#a77a1c']], 1, 1)}
    ${lin(`${p}-cloak`, [[0, '#2c4290'], [0.5, '#17245a'], [1, '#080e2c']], 1, 0.4)}
    ${lin(`${p}-book`, [[0, '#c4281f'], [1, '#6e0c08']], 1, 1)}
    <clipPath id="${p}-face"><path d="${face}"/></clipPath>
  </defs>
  <path d="M8 500 C18 418 76 372 150 356 L250 356 C324 372 382 418 392 500Z" fill="url(#${p}-cloak)"/>
  <path d="M168 352 L200 430 L232 352Z" fill="#0b1236"/>
  <path d="M172 276 L170 356 Q200 374 230 356 L228 276Z" fill="#c98d63"/>
  <path d="M172 300 Q200 322 228 300 L228 330 Q200 346 172 330Z" fill="rgba(90,45,25,.35)"/>
  <path d="M112 392 C100 330 108 270 128 228 C148 262 164 300 172 352 C160 364 136 376 112 392Z" fill="#22357a" stroke="#6f8ad8" stroke-width="2.5"/>
  <path d="M288 392 C300 330 292 270 272 228 C252 262 236 300 228 352 C240 364 264 376 288 392Z" fill="#141f4c" stroke="#4a62a8" stroke-width="2.5"/>
  <circle cx="200" cy="404" r="19" fill="#d8b24a" stroke="#5c430e" stroke-width="3"/><circle cx="200" cy="404" r="9" fill="#3d86d8" stroke="#183a66" stroke-width="2"/><circle cx="196" cy="400" r="3" fill="#cfe6ff"/>
  <path d="M138 168 C126 104 160 40 222 34 C280 30 322 70 318 134 C316 182 302 224 284 262 L262 252 C270 214 272 168 262 140Z" fill="#b8891f"/>
  <path d="M286 120 C302 156 300 204 284 254 M276 112 C292 150 292 196 278 240 M296 104 C314 140 314 180 304 216" fill="none" stroke="#7e5a12" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
  <path d="M132 178 C124 176 120 190 124 204 C128 218 136 222 142 218Z" fill="#d9a077"/><path d="M268 178 C276 176 280 190 276 204 C272 218 264 222 258 218Z" fill="#a8693f"/>
  <path d="${face}" fill="url(#${p}-skin)"/>
  ${shade(`${p}-face`, 'M226 96 C262 120 270 190 252 252 C240 284 224 296 206 300 L300 320 L300 80Z', 'rgba(120,58,30,.35)')}
  ${shade(`${p}-face`, 'M150 236 C160 270 182 292 200 296 C186 300 160 288 146 262Z', 'rgba(120,58,30,.18)')}
  <path d="M154 150 C164 141 178 140 190 145 L189 152 C178 149 166 150 156 156Z" fill="#9c7424"/>
  <path d="M246 150 C236 141 222 140 210 145 L211 152 C222 149 234 150 244 156Z" fill="#7d5a18"/>
  ${eye(p, 'L', 170, 172, { iris: '#3b82d4', look: 1.5 })}
  ${eye(p, 'R', 230, 172, { iris: '#2f6cb8', look: 1.5 })}
  ${nose(200, 176, 226)}
  <path d="M182 254 Q200 260 220 253" fill="none" stroke="#7a3a24" stroke-width="3" stroke-linecap="round"/>
  <path d="M186 258 Q200 266 216 257" fill="none" stroke="rgba(160,80,55,.55)" stroke-width="3"/>
  <path d="M176 248 Q178 253 181 254" fill="none" stroke="rgba(110,55,30,.5)" stroke-width="1.6"/>
  <path d="M188 274 Q200 279 212 274" fill="none" stroke="rgba(110,55,30,.3)" stroke-width="2"/>
  <path d="M138 176 C124 124 146 66 204 52 C250 42 296 64 306 112 C284 86 246 80 214 88 C186 96 162 112 152 136 C146 150 141 162 138 176Z" fill="url(#${p}-hair)"/>
  <path d="M150 132 C168 96 210 74 254 76 C284 78 302 94 310 116 C290 96 256 90 222 94 C192 98 166 112 150 132Z" fill="#fff8d0" opacity=".6"/>
  <path d="M152 140 C170 104 214 82 262 86 M160 128 C186 96 232 80 286 92 M176 112 C206 86 250 74 300 98 M146 158 C154 128 178 108 206 100 M200 96 C236 86 276 92 304 110" fill="none" stroke="#a2741c" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>
  <path d="M156 134 C150 146 146 158 145 170 M164 122 C158 136 155 150 156 160" fill="none" stroke="#f3d878" stroke-width="3" stroke-linecap="round"/>
  <path d="M232 450 L322 418 L350 500 L262 500Z" fill="url(#${p}-book)" stroke="#3c0604" stroke-width="3"/>
  <path d="M236 456 L322 424" stroke="#e7c35a" stroke-width="3"/><path d="M244 472 L328 442" stroke="#f3e2b8" stroke-width="5" opacity=".8"/>
  <path d="M250 436 C262 424 282 420 296 428 C304 434 300 446 290 448 L270 452 C262 462 248 466 240 458Z" fill="#e0a57c" stroke="#8a5233" stroke-width="2"/>
  <path d="M268 432 C276 430 284 432 290 438 M262 440 C272 438 280 440 286 446" fill="none" stroke="#8a5233" stroke-width="1.6"/>`);
}

function radnor() {
  const p = 'm-harkonnen';
  const head = 'M118 176 C114 102 154 58 204 58 C256 58 292 102 288 176 C286 236 268 282 238 306 C222 318 186 320 168 306 C138 284 120 238 118 176Z';
  return svg(p, 'Radnor, Mentat of House Harkonnen', `<defs>
    ${lin(`${p}-skin`, [[0, '#ecc6a0'], [0.5, '#cf9f78'], [1, '#7c4c30']])}
    ${lin(`${p}-robe`, [[0, '#6e2a1c'], [0.5, '#46160e'], [1, '#1c0604']], 1, 0.5)}
    ${lin(`${p}-hand`, [[0, '#f0c9a2'], [1, '#a86e48']])}
    <radialGradient id="${p}-shine" cx=".35" cy=".25" r=".5"><stop offset="0" stop-color="#fff2de" stop-opacity=".75"/><stop offset="1" stop-color="#fff2de" stop-opacity="0"/></radialGradient>
    <clipPath id="${p}-face"><path d="${head}"/></clipPath>
  </defs>
  <path d="M0 500 C6 410 70 362 150 344 L256 344 C336 362 396 410 400 500Z" fill="url(#${p}-robe)"/>
  <path d="M96 400 C116 360 150 340 176 334 C164 360 160 392 166 430Z M304 400 C284 360 250 340 226 334 C238 360 242 392 236 430Z" fill="#5a1f14" stroke="#2a0a06" stroke-width="2"/>
  <path d="M170 290 L168 350 Q202 368 236 350 L234 290Z" fill="#b98760"/>
  <path d="M110 186 C100 184 96 200 100 216 C104 230 114 234 122 228Z" fill="#c99670"/><path d="M296 186 C306 184 310 200 306 216 C302 230 292 234 284 228Z" fill="#8a5636"/>
  <path d="${head}" fill="url(#${p}-skin)"/>
  ${shade(`${p}-face`, 'M236 64 C284 96 296 180 276 248 C262 292 238 312 212 318 L320 330 L320 50Z', 'rgba(100,44,22,.38)')}
  <g clip-path="url(#${p}-face)"><ellipse cx="184" cy="100" rx="58" ry="34" fill="url(#${p}-shine)"/></g>
  <path d="M152 128 Q204 116 254 128 M160 142 Q204 132 248 142" fill="none" stroke="rgba(110,55,30,.35)" stroke-width="2" stroke-linecap="round"/>
  <path d="M138 160 C156 150 180 158 198 174 L194 182 C176 170 158 166 140 172Z" fill="#24140c"/>
  <path d="M268 160 C250 150 226 158 208 174 L212 182 C230 170 248 166 266 172Z" fill="#1a0e08"/>
  ${eye(p, 'L', 168, 188, { w: 17, open: 7, iris: '#5a3a1e', look: 3, heavy: 3, bag: 1 })}
  ${eye(p, 'R', 238, 188, { w: 17, open: 7, iris: '#4a2e16', look: 3, heavy: 3, bag: 1 })}
  ${nose(203, 192, 246, { w: 18, shade: 'rgba(90,40,20,.6)' })}
  <path d="M160 238 C166 258 174 270 182 276 M248 236 C244 256 236 270 228 278" fill="none" stroke="rgba(100,45,22,.45)" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M178 278 Q200 284 222 274 Q232 270 238 262" fill="none" stroke="#5c2614" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M184 283 Q204 292 224 280" fill="none" stroke="rgba(150,70,48,.55)" stroke-width="3"/>
  <path d="M236 258 Q240 262 238 268" fill="none" stroke="rgba(90,40,20,.6)" stroke-width="2"/>
  ${clasped(p)}`);
}

/** Two hands with the fingers laced, in front of the chest: each finger an outlined stroke, the two hands' fingers alternating. */
function clasped(p) {
  const finger = (d, light) => `<path d="${d}" fill="none" stroke="#5e331c" stroke-width="19" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${light}" stroke-width="14" stroke-linecap="round"/>`;
  const back = [];
  const front = [];
  for (let i = 0; i < 4; i++) {
    const y = 424 + i * 15;
    back.push(finger(`M258 ${y + 14} Q218 ${y - 2} 172 ${y + 2}`, '#b98058'));
    front.push(finger(`M146 ${y + 22} Q186 ${y + 4} 232 ${y + 8}`, '#e9bd94'));
  }
  return `<path d="M128 500 C116 470 120 434 146 420 L182 440 L170 500Z" fill="url(#${p}-hand)" stroke="#5e331c" stroke-width="2.5"/>
    <path d="M282 500 C296 470 292 432 266 418 L232 440 L246 500Z" fill="#a46a44" stroke="#5e331c" stroke-width="2.5"/>
    ${back.join('')}${front.join('')}
    <path d="M168 418 C186 404 208 404 222 414" fill="none" stroke="#5e331c" stroke-width="18" stroke-linecap="round"/><path d="M168 418 C186 404 208 404 222 414" fill="none" stroke="#f0c9a2" stroke-width="13" stroke-linecap="round"/>`;
}

function ammon() {
  const p = 'm-ordos';
  const face = 'M148 172 C146 228 158 270 182 296 C192 306 208 307 218 297 C243 271 254 228 252 172 C250 116 228 90 200 90 C172 90 150 116 148 172Z';
  return svg(p, 'Ammon, Mentat of House Ordos', `<defs>
    ${lin(`${p}-skin`, [[0, '#e8bd94'], [0.5, '#c9946a'], [1, '#86532f']])}
    ${lin(`${p}-hair`, [[0, '#7a5232'], [0.5, '#4a2e18'], [1, '#22140a']], 1, 1)}
    ${lin(`${p}-robe`, [[0, '#2f6a34'], [0.5, '#1a4420'], [1, '#08200c']], 1, 0.4)}
    <clipPath id="${p}-face"><path d="${face}"/></clipPath>
  </defs>
  <path d="M20 500 C30 420 86 374 154 358 L246 358 C314 374 370 420 380 500Z" fill="url(#${p}-robe)"/>
  <path d="M150 360 C168 350 186 348 200 350 C214 348 232 350 250 360 L238 384 C224 374 212 372 200 374 C188 372 176 374 162 384Z" fill="#2aa59a" stroke="#0e5650" stroke-width="2.5"/>
  <path d="M110 500 L268 362 L290 372 L140 500Z" fill="#8a7a3a" stroke="#4a3e14" stroke-width="2"/>
  <path d="M176 282 L174 360 Q200 374 226 360 L224 282Z" fill="#b8825a"/>
  <path d="M176 304 Q200 324 224 304 L224 330 Q200 344 176 330Z" fill="rgba(80,40,20,.35)"/>
  <path d="M186 376 L200 410 L214 376" fill="none" stroke="#c9a44a" stroke-width="2"/><path d="M200 408 L214 424 L200 442 L186 424Z" fill="#3fc25a" stroke="#c9a44a" stroke-width="3"/>
  <path d="M140 182 C132 180 128 194 132 208 C136 220 144 224 150 220Z" fill="#c8936a"/><path d="M260 182 C268 180 272 194 268 208 C264 220 256 224 250 220Z" fill="#86532f"/>
  <path d="M144 168 C134 196 134 228 144 252 L132 258 C120 228 120 190 130 164Z" fill="url(#${p}-hair)"/>
  <path d="M256 168 C266 196 266 228 256 252 L270 258 C282 226 282 188 270 164Z" fill="#1e1208"/>
  <path d="${face}" fill="url(#${p}-skin)"/>
  ${shade(`${p}-face`, 'M222 96 C254 122 260 192 244 256 C234 286 222 300 204 304 L290 320 L290 80Z', 'rgba(95,45,22,.38)')}
  ${shade(`${p}-face`, 'M156 214 C164 236 172 246 184 250 C170 252 160 244 154 230Z M246 214 C238 236 230 246 218 250 C232 252 242 244 248 230Z', 'rgba(95,45,22,.3)')}
  <path d="M158 156 C170 146 184 146 194 152 L192 158 C182 154 170 155 160 162Z" fill="#3a2414"/>
  <path d="M242 156 C230 146 216 146 206 152 L208 158 C218 154 230 155 240 162Z" fill="#2a180c"/>
  ${eye(p, 'L', 174, 176, { w: 16, open: 7.5, iris: '#5c7a3a', look: -1, heavy: 1 })}
  ${eye(p, 'R', 226, 176, { w: 16, open: 7.5, iris: '#4c6a2e', look: -1, heavy: 1 })}
  ${nose(200, 180, 230, { w: 12 })}
  <path d="M184 258 Q200 262 216 257" fill="none" stroke="#6a301a" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M188 263 Q200 268 212 262" fill="none" stroke="rgba(140,70,45,.5)" stroke-width="2.4"/>
  <path d="M142 178 C132 118 160 70 210 66 C252 62 276 96 270 156 C268 172 262 182 256 186 C254 148 240 120 220 112 C198 104 178 106 164 116 C152 128 146 150 142 178Z" fill="url(#${p}-hair)"/>
  <path d="M158 112 C182 88 224 82 252 100 M164 124 C188 100 226 96 256 116 M152 140 C164 116 190 104 214 104" fill="none" stroke="#a07448" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  <path d="M268 402 C292 382 324 384 340 404 L352 500 L250 500 C246 470 252 428 268 402Z" fill="#1e4f24" stroke="#0a2a0e" stroke-width="2"/>
  <path d="M226 420 C240 400 266 394 288 402 C300 408 300 424 290 430 C276 438 262 438 252 450 C240 460 222 458 218 444 C214 436 218 428 226 420Z" fill="#cf9a70" stroke="#7a4626" stroke-width="2"/>
  <path d="M234 420 C248 412 266 410 282 414 M230 434 C244 426 262 424 280 428" fill="none" stroke="#7a4626" stroke-width="1.6"/>
  <circle cx="246" cy="417" r="4.5" fill="#3fc25a" stroke="#c9a44a" stroke-width="2"/>`);
}

const ART = { atreides: cyril, harkonnen: radnor, ordos: ammon };

/** SVG markup for a house's Mentat (empty for a house without one). */
export function mentatSvg(house) { return ART[house]?.() ?? ''; }
