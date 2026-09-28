// URL query → typed getters.
export function readParams(search = globalThis.location?.search ?? '') {
  const p = new URLSearchParams(search);
  const has = (k) => p.has(k) && p.get(k) !== '';
  return {
    raw: p,
    str: (k, d = null) => (has(k) ? p.get(k) : d),
    num: (k, d = null) => (has(k) && !Number.isNaN(Number(p.get(k))) ? Number(p.get(k)) : d),
    bool: (k, d = false) => (has(k) ? !['0', 'false', 'no', 'off'].includes(p.get(k)) : d),
  };
}
