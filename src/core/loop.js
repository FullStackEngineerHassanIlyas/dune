// Fixed-step accumulator: the simulation advances in whole ticks, rendering interpolates with alpha.
// A long stall (hidden tab, debugger) runs at most maxSteps ticks and drops the rest of the backlog.
export class FixedLoop {
  constructor(step, { maxSteps = 5 } = {}) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.acc = 0;
  }

  advance(dtSeconds, speed = 1) {
    this.acc += Math.min(Math.max(dtSeconds, 0), 0.25) * speed;
    let steps = 0;
    while (this.acc >= this.step - 1e-9 && steps < this.maxSteps) { this.acc -= this.step; steps++; }
    if (steps === this.maxSteps && this.acc >= this.step) this.acc %= this.step;
    if (this.acc < 0) this.acc = 0;
    return { steps, alpha: this.acc / this.step };
  }
}
