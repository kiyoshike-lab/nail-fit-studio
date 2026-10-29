import type { NailCalibration } from "./nailCalibration";

type Observation = { correction: NailCalibration; at: number };

function agrees(a: NailCalibration, b: NailCalibration, tolerance = 1) {
  return Math.abs(a.side - b.side) < 0.3 * tolerance
    && Math.abs(a.along - b.along) < 0.25 * tolerance
    && Math.abs(Math.log(a.width / b.width)) < 0.23 * tolerance
    && Math.abs(Math.log(a.height / b.height)) < 0.23 * tolerance
    && Math.abs(((a.rotation - b.rotation + 540) % 360) - 180) < 12 * tolerance;
}

// Compare image corrections in FINGER units, never screen pixels. Moving closer,
// rotating or translating the whole hand must not be mistaken for a bad fit.
export class NailCorrectionGate {
  private confirmed?: Observation;
  private pending?: Observation;

  update(correction: NailCalibration, now: number) {
    const previous = this.confirmed;
    if (!previous || now < previous.at || now - previous.at > 450 || agrees(correction, previous.correction)) {
      this.confirmed = { correction, at: now };
      this.pending = undefined;
      return { correction, held: false };
    }
    if (this.pending && now - this.pending.at <= 350 && agrees(correction, this.pending.correction, 0.5)) {
      this.confirmed = { correction, at: now };
      this.pending = undefined;
      return { correction, held: false };
    }
    this.pending = { correction, at: now };
    return { correction: previous.correction, held: true };
  }
}
