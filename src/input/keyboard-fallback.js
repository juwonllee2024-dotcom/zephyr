// Always-available keyboard controls so the game never hard-requires a camera.

export class KeyboardControls {
  constructor() {
    this.keys = new Set();
    this.enabled = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  has(code) {
    return this.keys.has(code);
  }

  getControls() {
    if (!this.enabled) return { targetPitch: 0, targetRoll: 0, flap: 0 };
    const left = this.has('KeyA') || this.has('ArrowLeft');
    const right = this.has('KeyD') || this.has('ArrowRight');
    const up = this.has('KeyW') || this.has('ArrowUp');
    const down = this.has('KeyS') || this.has('ArrowDown');
    return {
      targetPitch: (up ? 1 : 0) - (down ? 1 : 0),
      targetRoll: (right ? 1 : 0) - (left ? 1 : 0),
      flap: this.has('Space') ? 1 : 0,
    };
  }
}
