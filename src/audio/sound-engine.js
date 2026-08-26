// Fully procedural WebAudio soundscape — wind, chimes, whooshes, impacts.
// No audio assets; created lazily on first user gesture.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this.padGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    // ---- wind: looping filtered noise
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.03;
    noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    noise.start();

    // ---- ambient pad: two detuned triangles through a slow-breathing gain
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 700;
    this.padGain.connect(padFilter).connect(this.master);
    for (const f of [146.83, 220.0, 293.66]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 9;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g).connect(this.padGain);
      osc.start();
    }
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(this.padGain.gain);
    lfo.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  // speed01 ∈ [0,1]
  setWind(speed01, airborne = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(airborne ? 0.02 + speed01 * 0.16 : 0.015, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(320 + speed01 * 1500, t, 0.25);
    this.padGain.gain.setTargetAtTime(airborne ? 0.5 : 0.22, t, 1.2);
  }

  // pentatonic pluck; higher combos climb the scale
  chime(combo = 1, perfect = false) {
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const base = scale[Math.min(scale.length - 1, Math.max(0, combo - 1))];
    this._pluck(base, 0.32);
    if (perfect) this._pluck(base * 1.5, 0.22, 0.06);
  }

  _pluck(freq, gain = 0.3, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.9);
  }

  whoosh(power = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.28;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + dur);
    bp.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.value = 0.12 * power;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }

  thud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  comboLost() {
    if (!this.ctx) return;
    this._pluck(392, 0.12);
    this._pluck(311, 0.12, 0.12);
  }
}
