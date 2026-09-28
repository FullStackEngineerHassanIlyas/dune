// Fog layer (0/1 per tile) → the terrain's shroud bytes (0/255), refreshed only when the fog changed.
export class ShroudSync {
  constructor(n) {
    this.explored = new Uint8Array(n);
    this.visible = new Uint8Array(n);
    this.revision = -1;
  }

  update(fog) {
    if (!fog || fog.revision === this.revision) return false;
    this.revision = fog.revision;
    for (let i = 0; i < this.explored.length; i++) {
      this.explored[i] = fog.explored[i] * 255;
      this.visible[i] = fog.visible[i] * 255;
    }
    return true;
  }
}
