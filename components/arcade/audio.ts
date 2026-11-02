// All sound is synthesized with Web Audio: no files to download.

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdOn = false;
  private music: Music | null = null;
  private wantMusic = false;
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
    this.crowd.gain.value = this.crowdOn ? 0.04 : 0;
    src.connect(bp).connect(this.crowd).connect(this.master);
    src.start();
    if (this.wantMusic) this.setMusic(true);
  }

  stop() {
    this.music?.stop();
    this.music = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  /** The crowd only murmurs during a game; on the menus it's quiet. */
  setCrowd(on: boolean) {
    this.crowdOn = on;
    if (this.ctx && this.crowd) this.crowd.gain.setTargetAtTime(on ? 0.04 : 0, this.ctx.currentTime, 0.3);
  }

  /** Lobby music: an arena organ tune on a loop. Starts once audio is allowed (after a tap). */
  setMusic(on: boolean) {
    this.wantMusic = on;
    if (!this.ctx || !this.master) return;
    if (on && !this.music) {
      this.music = new Music(this.ctx, this.master, this.noise!);
      this.music.play();
    } else if (!on && this.music) {
      this.music.stop();
      this.music = null;
    }
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
    if (!this.ctx || !this.crowd || !this.crowdOn) return;
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

// ————— lobby music —————

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const BPM = 128;
const STEP = 60 / BPM / 4; // a sixteenth note

// Eight bars in G: G G C D | Em C D D. Chords as MIDI notes (organ voicing), bass roots.
const CHORDS = [
  [55, 59, 62],
  [55, 59, 62],
  [55, 60, 64],
  [57, 62, 66],
  [55, 59, 64],
  [55, 60, 64],
  [57, 62, 66],
  [57, 62, 66],
];
const ROOTS = [43, 43, 36, 38, 40, 36, 38, 38];
// The tune: [sixteenth in the bar, note, length in sixteenths], one list per bar.
const TUNE: [number, number, number][][] = [
  [[0, 67, 2], [2, 71, 2], [4, 74, 2], [6, 79, 4], [12, 78, 2], [14, 79, 2]],
  [[0, 74, 4], [6, 71, 2], [8, 74, 6]],
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 84, 4], [12, 83, 2], [14, 81, 2]],
  [[0, 78, 4], [4, 74, 2], [6, 78, 2], [8, 81, 8]],
  [[0, 79, 2], [2, 78, 2], [4, 76, 2], [6, 71, 2], [8, 76, 4], [12, 79, 4]],
  [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 67, 2], [8, 72, 4], [12, 76, 4]],
  [[0, 74, 2], [2, 76, 2], [4, 78, 2], [6, 81, 2], [8, 78, 2], [10, 81, 2], [12, 86, 4]],
  [[0, 81, 2], [2, 81, 2], [4, 81, 2], [6, 86, 10]],
];

/**
 * A bouncy stadium-organ tune: organ lead and off-beat chord stabs, an oom-pah bass, kick,
 * claps and hats. Sixteen bars on a loop: the tune, then a round of organ arpeggios.
 * Notes are scheduled a little ahead on the audio clock, so timers can be sloppy.
 */
class Music {
  private out: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0; // audio time of the next sixteenth
  private step = 0; // sixteenths since the start

  constructor(
    private ctx: AudioContext,
    master: GainNode,
    private noise: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    const tone = ctx.createBiquadFilter(); // takes the fizz off the square waves
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    this.out.connect(tone).connect(master);
  }

  play() {
    const t = this.ctx.currentTime;
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(0.6, t + 1.2); // fade in
    this.next = t + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.15);
    const out = this.out;
    setTimeout(() => out.disconnect(), 1200);
  }

  private schedule() {
    // A suspended context (game paused, app in the background) doesn't move: don't pile up notes.
    if (this.next < this.ctx.currentTime - 0.2) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.15) {
      this.play16(this.step, this.next);
      this.next += STEP;
      this.step++;
    }
  }

  private play16(n: number, t: number) {
    const s = n % 16; // sixteenth in the bar
    const bar = Math.floor(n / 16) % 16;
    const b = bar % 8;
    const tune = bar < 8;
    const chord = CHORDS[b];
    // Drums: kick on 1 and 3 (and a push into the next bar), claps on 2 and 4, hats on the off-beats.
    if (s === 0 || s === 8 || (s === 14 && b % 2 === 1)) this.kick(t);
    if (s === 4 || s === 12) this.clap(t);
    if (s % 4 === 2) this.hat(t, 0.05);
    if (b === 7 && s >= 12) this.clap(t, 0.12); // drum fill into the top
    // Oom-pah bass on the eighths.
    if (s % 2 === 0) {
      const r = ROOTS[b];
      const pat = [0, 12, 7, 12];
      this.bass(hz(r + pat[(s / 2) % 4]), STEP * 1.8, t);
    }
    if (tune) {
      // Off-beat organ stabs under the tune.
      if (s % 4 === 2) for (const m of chord) this.organ(hz(m), STEP * 1.2, 0.035, t);
      for (const [at, m, len] of TUNE[b]) if (at === s) this.organ(hz(m), STEP * len * 0.92, 0.075, t, true);
    } else {
      // Arpeggios up and down the chord, an octave up.
      const arp = [0, 1, 2, 1];
      this.organ(hz(chord[arp[s % 4]] + 12), STEP * 0.9, 0.05, t);
      if (s === 0) for (const m of chord) this.organ(hz(m), STEP * 7, 0.03, t);
    }
  }

  /** A drawbar organ: a few sine partials, and a little wobble on the lead. */
  private organ(f: number, dur: number, gain: number, t: number, lead = false) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + Math.max(0.02, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    g.connect(this.out);
    const partials: [number, number, OscillatorType][] = [
      [1, 1, "sine"],
      [2, 0.55, "sine"],
      [3, 0.25, "sine"],
      [4, 0.18, "triangle"],
    ];
    let vib: OscillatorNode | null = null;
    let depth: GainNode | null = null;
    if (lead) {
      vib = ctx.createOscillator();
      vib.frequency.value = 6;
      depth = ctx.createGain();
      depth.gain.value = 9; // cents
      vib.connect(depth);
      vib.start(t);
      vib.stop(t + dur + 0.1);
    }
    for (const [mult, level, type] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      if (depth) depth.connect(o.detune);
      const pg = ctx.createGain();
      pg.gain.value = level;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
  }

  private bass(f: number, dur: number, t: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }

  private hiss(t: number, dur: number, freq: number, type: BiquadFilterType, gain: number, q = 0.8) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  /** A crowd-ish hand clap: three quick noise slaps. */
  private clap(t: number, gain = 0.2) {
    for (const k of [0, 0.011, 0.022]) this.hiss(t + k, k === 0.022 ? 0.14 : 0.02, 1400, "bandpass", gain, 1.1);
  }

  private hat(t: number, gain: number) {
    this.hiss(t, 0.04, 8000, "highpass", gain);
  }
}
