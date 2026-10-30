// All sound is synthesized with Web Audio: no files to download.

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture (iOS). */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Crowd bed: filtered noise, swells with the action.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0.04;
    src.connect(bp).connect(this.crowd).connect(this.master);
    src.start();
  }

  stop() {
    void this.ctx?.close();
    this.ctx = null;
  }

  pause(p: boolean) {
    if (!this.ctx) return;
    void (p ? this.ctx.suspend() : this.ctx.resume());
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** 0..1, how loud the crowd is right now. */
  excitement(x: number) {
    if (!this.ctx || !this.crowd) return;
    this.crowd.gain.setTargetAtTime(0.03 + x * 0.09, this.ctx.currentTime, 0.4);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass", when = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", slideTo?: number, when = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot(power: number, slap: boolean) {
    this.burst(0.05, 2400, 1.2, 0.5 + power * 0.5);
    this.tone(slap ? 180 : 320, 0.06, 0.3, "triangle", 90);
    if (slap) this.burst(0.18, 900, 0.8, 0.35);
  }

  pass() {
    this.burst(0.035, 3000, 1.5, 0.28);
  }

  boards(power: number) {
    this.tone(85, 0.25, Math.min(0.7, power / 30), "sine", 45);
    this.burst(0.12, 300, 0.8, Math.min(0.4, power / 40), "lowpass");
  }

  post() {
    this.tone(1760, 0.9, 0.35, "sine");
    this.tone(2637, 0.6, 0.18, "sine");
    this.tone(4186, 0.3, 0.08, "sine");
  }

  hit(power: number) {
    this.tone(140, 0.3, Math.min(0.9, 0.3 + power / 25), "sine", 38);
    this.burst(0.2, 500, 0.7, Math.min(0.6, power / 25), "lowpass");
    this.burst(0.5, 1200, 0.4, 0.12, "bandpass", 0.05); // crowd "ooh"
  }

  save() {
    this.burst(0.08, 900, 1, 0.35, "lowpass");
  }

  whistle() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 2900;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 38;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.45);
    lfo.stop(t + 0.45);
  }

  /** The goal horn: a fat detuned chord, then the crowd. */
  horn(ours: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ours ? 0.3 : 0.12, t + 0.05);
    g.gain.setValueAtTime(ours ? 0.3 : 0.12, t + 2.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    lp.connect(g).connect(this.master);
    for (const f of [110, 138.6, 164.8, 220]) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + 2.7);
      }
    }
    this.burst(2.8, 800, 0.5, ours ? 0.5 : 0.18);
    if (ours) this.organ(2.8);
  }

  /** Stadium organ "charge" riff. */
  organ(when = 0) {
    const notes = [392, 523.3, 659.3, 784, 659.3, 784];
    const at = [0, 0.15, 0.3, 0.45, 0.75, 0.9];
    notes.forEach((f, i) => {
      this.tone(f, i === 5 ? 0.5 : 0.13, 0.12, "square", undefined, when + at[i]);
      this.tone(f / 2, i === 5 ? 0.5 : 0.13, 0.08, "square", undefined, when + at[i]);
    });
  }

  /** "DROP! DROP! DROP!" — three crowd stomps and claps. */
  chant() {
    for (let i = 0; i < 3; i++) {
      this.tone(70, 0.18, 0.5, "sine", 40, i * 0.42);
      this.burst(0.15, 1500, 0.6, 0.35, "bandpass", i * 0.42 + 0.02);
    }
  }

  steal() {
    this.burst(0.04, 1800, 2, 0.25);
  }

  end(won: boolean) {
    if (won) {
      this.horn(true);
      return;
    }
    this.tone(220, 0.5, 0.15, "triangle", 110);
    this.tone(164.8, 0.8, 0.15, "triangle", 82, 0.4);
  }
}
