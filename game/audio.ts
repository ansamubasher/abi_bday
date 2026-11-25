/**
 * Fully synthesised audio — no files to license or load.
 * Ambient drone + sparse bell notes that shift per zone, and small SFX.
 */
type Sfx =
  | "jump" | "land" | "slash" | "hit" | "kill" | "hurt" | "dash" | "wisp" | "light"
  | "bench" | "altar" | "letter" | "boss" | "bossdie" | "click" | "tablet" | "rune";

const ZONE_ROOTS = [110, 98, 82.4, 73.4]; // A2, G2, E2, D2
const SCALE = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic-ish

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private echo!: DelayNode;
  private drone: { o: OscillatorNode; g: GainNode; ratio: number }[] = [];
  private filter!: BiquadFilterNode;
  private bellTimer: ReturnType<typeof setTimeout> | null = null;
  private zone = 0;
  private tension = 0;
  muted = false;

  get ready() {
    return !!this.ctx;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    this.music = ctx.createGain();
    this.music.gain.value = 0.0;
    this.music.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 700;
    this.filter.Q.value = 0.6;
    this.music.connect(this.filter);
    this.filter.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);

    // soft echo for bells
    this.echo = ctx.createDelay(1.5);
    this.echo.delayTime.value = 0.52;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    this.echo.connect(damp);
    damp.connect(fb);
    fb.connect(this.echo);
    damp.connect(this.master);

    // drone: root, fifth, octave, with a slow swell
    const ratios = [1, 1.5, 2, 3.01];
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = ZONE_ROOTS[0] * r;
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.22, 0.18, 0.05][i];
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = g.gain.value * 0.45;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
      o.connect(g);
      g.connect(this.music);
      o.start();
      this.drone.push({ o, g, ratio: r });
    });
    this.scheduleBell();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  setZone(z: number) {
    this.zone = z;
    if (!this.ctx) return;
    const root = ZONE_ROOTS[z] ?? 110;
    this.drone.forEach((d) => d.o.frequency.setTargetAtTime(root * d.ratio, this.ctx!.currentTime, 2.5));
  }

  /** 0 calm → 1 boss */
  setTension(t: number) {
    this.tension = t;
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(700 + t * 1400, this.ctx.currentTime, 0.8);
    this.music.gain.setTargetAtTime(0.5 + t * 0.25, this.ctx.currentTime, 0.8);
  }

  private scheduleBell() {
    const wait = (this.tension > 0.5 ? 2500 : 5500) + Math.random() * 6000;
    this.bellTimer = setTimeout(() => {
      this.bell();
      this.scheduleBell();
    }, wait);
  }

  private bell(semis?: number, vol = 0.09) {
    const ctx = this.ctx;
    if (!ctx) return;
    const root = (ZONE_ROOTS[this.zone] ?? 110) * 4;
    const s = semis ?? SCALE[Math.floor(Math.random() * SCALE.length)];
    this.tone(root * Math.pow(2, s / 12), vol, 2.6, "sine", true);
  }

  private tone(freq: number, vol: number, dur: number, type: OscillatorType = "sine", echo = false, bus?: GainNode, when = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    if (echo) g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, q = 1, when = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
  }

  sfx(name: Sfx) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "jump": this.tone(300, 0.1, 0.14, "triangle"); this.tone(480, 0.06, 0.12, "sine", false, undefined, 0.03); break;
      case "land": this.noise(0.08, 0.12, 300, 90, 0.8); break;
      case "slash": this.noise(0.14, 0.2, 2400, 500, 1.4); break;
      case "hit": this.noise(0.1, 0.25, 900, 200, 1); this.tone(130, 0.2, 0.12, "square"); break;
      case "kill": this.noise(0.25, 0.25, 1200, 100, 0.8); this.tone(90, 0.3, 0.3, "sawtooth"); break;
      case "hurt": this.tone(220, 0.25, 0.4, "sawtooth"); this.tone(110, 0.25, 0.5, "square"); this.noise(0.2, 0.2, 600, 100); break;
      case "dash": this.noise(0.2, 0.22, 700, 3000, 0.7); break;
      case "wisp": this.tone(880, 0.1, 0.35, "sine", true); this.tone(1320, 0.07, 0.4, "sine", true, undefined, 0.07); break;
      case "light":
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), 0.12, 2.4, "sine", true, undefined, i * 0.11));
        break;
      case "bench": this.tone(262, 0.1, 1.6, "sine", true); this.tone(392, 0.08, 1.8, "sine", true, undefined, 0.2); break;
      case "altar":
        [0, 7, 12, 19, 24].forEach((s, i) => this.tone(220 * Math.pow(2, s / 12), 0.14, 3, "triangle", true, undefined, i * 0.16));
        break;
      case "letter": this.noise(0.4, 0.1, 3000, 800, 0.5); this.tone(523, 0.08, 2, "sine", true, undefined, 0.3); break;
      case "boss": this.tone(55, 0.35, 2.4, "sawtooth"); this.tone(58, 0.3, 2.4, "sawtooth"); this.noise(1.2, 0.15, 200, 60, 0.6); break;
      case "bossdie":
        this.noise(1.4, 0.3, 1500, 60, 0.5);
        [0, -5, -12].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), 0.15, 3, "sine", true, undefined, 0.4 + i * 0.25));
        break;
      case "click": this.tone(600, 0.05, 0.05, "square"); break;
      case "tablet": this.noise(0.25, 0.08, 800, 400, 0.6); break;
      case "rune": this.tone(180, 0.2, 1.2, "triangle", true); this.tone(270, 0.12, 1.2, "triangle", true, undefined, 0.1); break;
    }
  }

  dispose() {
    if (this.bellTimer) clearTimeout(this.bellTimer);
    this.bellTimer = null;
    this.drone.forEach((d) => {
      try { d.o.stop(); } catch { /* already stopped */ }
    });
    this.drone = [];
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioEngine();
