/** Discrete gestures drive bounded animation; raw tracking coordinates never drive the camera. */
export class CameraMotion {
  height = 2.45;
  private lastAt: number | null = null;
  private jumpSerial = 0;
  private jumpingAt = -Infinity;
  private duck = 0;
  private lostAt: number | null = null;
  private heldCrouch = false;
  update(
    now: number,
    crouched: boolean,
    jumpSerial: number,
    tracked: boolean,
    reduced: boolean,
  ): number {
    const dt = this.lastAt === null ? 0 : Math.max(0, Math.min(50, now - this.lastAt));
    this.lastAt = now;
    if (jumpSerial > this.jumpSerial && tracked) this.jumpingAt = now;
    if (jumpSerial < this.jumpSerial) this.jumpingAt = -Infinity;
    this.jumpSerial = jumpSerial;
    if (tracked) {
      this.lostAt = null;
      this.heldCrouch = crouched;
    } else {
      this.lostAt ??= now;
      if (now - this.lostAt > 120) this.heldCrouch = false;
    }
    // Complete an already accepted jump; a dropped frame must not snap its arc shut.
    this.duck += ((this.heldCrouch ? 1 : 0) - this.duck) * (1 - Math.exp(-dt / 150));
    const t = (now - this.jumpingAt) / 850;
    const arc = t >= 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
    const target = 2.45 - this.duck * 1.2 + arc * (reduced ? 0.65 : 1.25);
    this.height += (target - this.height) * (1 - Math.exp(-dt / 65));
    return this.height;
  }
}
