// The house crests of the house selection (spec §5.8: hawk, ram, serpent), our own SVG drawings: a gold frame
// with corner studs around a silver shield, as the Sega screen frames them (research.md §4), with the Atreides
// hawk in blue, the Ordos serpent in green and the Harkonnen ram's head in red. Markup strings for innerHTML.

const frame = (p, accent) => `
  <defs>
    <linearGradient id="${p}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".3" stop-color="#e2b043"/><stop offset=".55" stop-color="#8a5a12"/><stop offset=".8" stop-color="#e8bb52"/><stop offset="1" stop-color="#6e4408"/></linearGradient>
    <linearGradient id="${p}-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c9d0d8"/><stop offset=".7" stop-color="#8d97a4"/><stop offset="1" stop-color="#dfe4ea"/></linearGradient>
    <radialGradient id="${p}-field" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${accent}" stop-opacity=".55"/><stop offset="1" stop-color="#05070c" stop-opacity=".95"/></radialGradient>
  </defs>
  <rect x="4" y="4" width="232" height="232" rx="10" fill="url(#${p}-gold)" stroke="#3c2604" stroke-width="3"/>
  <rect x="20" y="20" width="200" height="200" rx="4" fill="#1a1206" stroke="#3c2604" stroke-width="2"/>
  <rect x="26" y="26" width="188" height="188" fill="url(#${p}-field)"/>
  <path d="M14 30 Q14 14 30 14 M210 14 Q226 14 226 30 M226 210 Q226 226 210 226 M30 226 Q14 226 14 210" fill="none" stroke="#fff4c4" stroke-width="2" opacity=".7"/>
  ${[[20, 20], [220, 20], [20, 220], [220, 220], [120, 12], [120, 228], [12, 120], [228, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${accent}" stroke="#3c2604" stroke-width="2"/><circle cx="${x - 2}" cy="${y - 2}" r="2.2" fill="#fff" opacity=".8"/>`).join('')}
  <path d="M60 46 L180 46 L180 128 C180 170 150 192 120 204 C90 192 60 170 60 128Z" fill="url(#${p}-silver)" stroke="#2c3440" stroke-width="3"/>
  <path d="M66 52 L174 52 L174 126 C174 164 148 184 120 196 C92 184 66 164 66 126Z" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>`;

/** The Atreides hawk: wings spread, head turned, in blue. */
const hawk = `
  <path d="M120 76 C112 76 106 84 108 92 L96 100 L110 102 C108 116 110 130 120 144 C130 130 132 116 130 102 C134 92 130 78 120 76Z" fill="#1d4f9a" stroke="#0a1c3a" stroke-width="2"/>
  <path d="M108 104 C92 92 80 76 68 70 C72 90 72 104 80 116 C74 118 70 124 70 130 C84 126 96 122 108 120Z" fill="#2f6fe0" stroke="#0a1c3a" stroke-width="2"/>
  <path d="M132 104 C148 92 160 76 172 70 C168 90 168 104 160 116 C166 118 170 124 170 130 C156 126 144 122 132 120Z" fill="#2a63c8" stroke="#0a1c3a" stroke-width="2"/>
  <path d="M74 80 L92 98 M70 98 L94 108 M76 116 L100 116 M166 80 L148 98 M170 98 L146 108 M164 116 L140 116" stroke="#9cc4ff" stroke-width="2" stroke-linecap="round"/>
  <path d="M112 142 L120 168 L128 142 C124 146 116 146 112 142Z" fill="#1d4f9a" stroke="#0a1c3a" stroke-width="2"/>
  <path d="M106 150 L100 162 M134 150 L140 162" stroke="#0a1c3a" stroke-width="3" stroke-linecap="round"/>
  <circle cx="116" cy="86" r="2.6" fill="#ffd24a"/><path d="M108 90 L100 96 L109 95Z" fill="#e8b02a"/>`;

/** The Ordos serpent: an S-coil with its head raised, in green. */
const serpent = `
  <path d="M140 72 C120 66 98 74 98 92 C98 110 126 112 140 122 C156 134 152 156 132 162 C112 168 92 160 86 146" fill="none" stroke="#0c3a14" stroke-width="20" stroke-linecap="round"/>
  <path d="M140 72 C120 66 98 74 98 92 C98 110 126 112 140 122 C156 134 152 156 132 162 C112 168 92 160 86 146" fill="none" stroke="#2e9e3e" stroke-width="14" stroke-linecap="round"/>
  <path d="M140 72 C120 66 98 74 98 92 C98 110 126 112 140 122 C156 134 152 156 132 162 C112 168 92 160 86 146" fill="none" stroke="#9fe39a" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/>
  <path d="M136 62 C150 56 164 62 164 72 C164 82 150 86 138 82 C134 76 134 68 136 62Z" fill="#2e9e3e" stroke="#0c3a14" stroke-width="2.5"/>
  <circle cx="152" cy="68" r="2.8" fill="#ffd24a"/><path d="M164 74 L176 72 M170 72 L176 68 M170 72 L176 77" stroke="#c8261e" stroke-width="2" stroke-linecap="round"/>`;

/** The Harkonnen ram: a head facing out, the horns curled, in red and dark iron. */
const ram = `
  <path d="M98 84 C72 70 58 92 66 112 C72 128 92 128 96 114 C98 106 92 100 86 104" fill="none" stroke="#3a0a06" stroke-width="16" stroke-linecap="round"/>
  <path d="M98 84 C72 70 58 92 66 112 C72 128 92 128 96 114 C98 106 92 100 86 104" fill="none" stroke="#c8261e" stroke-width="10" stroke-linecap="round"/>
  <path d="M142 84 C168 70 182 92 174 112 C168 128 148 128 144 114 C142 106 148 100 154 104" fill="none" stroke="#3a0a06" stroke-width="16" stroke-linecap="round"/>
  <path d="M142 84 C168 70 182 92 174 112 C168 128 148 128 144 114 C142 106 148 100 154 104" fill="none" stroke="#c8261e" stroke-width="10" stroke-linecap="round"/>
  <path d="M74 92 L80 100 M66 106 L76 108 M166 92 L160 100 M174 106 L164 108" stroke="#ff8a6a" stroke-width="2" stroke-linecap="round"/>
  <path d="M100 82 C110 76 130 76 140 82 C146 96 144 116 138 136 C134 152 128 164 120 168 C112 164 106 152 102 136 C96 116 94 96 100 82Z" fill="#5a1410" stroke="#1c0402" stroke-width="2.5"/>
  <path d="M106 98 L116 106 M134 98 L124 106" stroke="#1c0402" stroke-width="3" stroke-linecap="round"/>
  <circle cx="111" cy="104" r="3" fill="#ffd24a"/><circle cx="129" cy="104" r="3" fill="#ffd24a"/>
  <path d="M112 156 C116 162 124 162 128 156" fill="none" stroke="#1c0402" stroke-width="2.5"/><path d="M116 148 L114 152 M124 148 L126 152" stroke="#1c0402" stroke-width="2"/>`;

const CRESTS = { atreides: ['#2f6fe0', hawk, 'The Atreides hawk'], ordos: ['#2e9e3e', serpent, 'The Ordos serpent'], harkonnen: ['#c8261e', ram, 'The Harkonnen ram'] };

/** SVG markup for a house's crest in its gold frame (empty for a house without one). */
export function crestSvg(house) {
  const c = CRESTS[house];
  if (!c) return '';
  const [accent, emblem, label] = c;
  return `<svg class="cp-crest-art" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${frame(`c-${house}`, accent)}${emblem}</svg>`;
}
