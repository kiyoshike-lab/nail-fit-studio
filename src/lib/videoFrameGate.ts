// Consume compositor frames, not only HTMLMediaElement.currentTime. Safari can
// expose a stalled/reduced-precision media clock while delivering new frames.
export class VideoFrameGate {
  private serial = 0;
  private consumed = 0;
  private presented = -1;
  private callbackAt = -Infinity;
  private lastTime = -1;
  private lastQuality = -1;

  observe(now: number, presentedFrames?: number) {
    if (presentedFrames !== undefined && presentedFrames === this.presented) return;
    this.presented = presentedFrames ?? this.presented;
    this.serial++;
    this.callbackAt = now;
  }

  take(now: number, videoTime: number, qualityFrames?: number) {
    if (!qualityFrames || qualityFrames < 0) qualityFrames = undefined;
    if (this.serial > this.consumed) {
      this.consumed = this.serial;
      this.lastTime = videoTime;
      if (qualityFrames !== undefined) this.lastQuality = qualityFrames;
      return true;
    }
    // Do not infer twice when currentTime changes before/after a callback for
    // the same frame. If callbacks stall, native frame counters/clock can recover.
    if (now - this.callbackAt < 750) return false;
    const fresh = (qualityFrames !== undefined && qualityFrames > this.lastQuality)
      || (Number.isFinite(videoTime) && videoTime !== this.lastTime);
    if (!fresh) return false;
    this.serial++; this.consumed = this.serial;
    this.lastTime = videoTime;
    if (qualityFrames !== undefined) this.lastQuality = qualityFrames;
    return true;
  }

  get updates() { return this.serial; }
}
