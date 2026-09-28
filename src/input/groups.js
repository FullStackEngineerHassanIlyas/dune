// Control groups (spec §5.7): Ctrl+digit assigns, digit selects, a quick second tap centres the view.
export class Groups {
  constructor() { this.map = new Map(); this.last = { n: -1, t: -1e9 }; }
  assign(n, ids) { this.map.set(n, [...ids]); }
  get(n, alive = () => true) {
    const ids = (this.map.get(n) ?? []).filter(alive);
    this.map.set(n, ids);
    return ids;
  }
  tap(n, now) {
    const double = this.last.n === n && now - this.last.t < 350;
    this.last = { n, t: double ? -1e9 : now };
    return double ? 'center' : 'select';
  }
  groupOf(id) {
    for (const [n, ids] of this.map) if (ids.includes(id)) return n;
    return null;
  }
}
