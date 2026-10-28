export type Voice = 'fm' | 'chip' | 'modular';
export type Patch = { voice: Voice; cutoff: number; decay: number; tone: number; resonance: number; volume: number };
export type Pattern = { drums: boolean[][]; notes: (number | null)[] };
export type SynthTrack = { notes: (number | null)[]; patch: Patch; muted: boolean; volume: number };
export class Engine {
  context: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private warmSource: AudioBufferSourceNode | null = null;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private generation = 0;
  private remaining = Infinity;
  playing = false;
  bpm = 112;
  swing = 0;
  muted = Array(4).fill(false) as boolean[];
  drumKinds = [0,1,2,3];
  drumVolumes = [1,1,1,1];
  activeTrack = 0;
  masterVolume = .7;
  tracks: SynthTrack[] = Array.from({length: 1}, (_, i) => ({notes: Array(16).fill(null), muted:false, volume:1, patch:{voice: i===1?'chip':i===2?'modular':'fm', cutoff:2800, decay:.28, tone:40, resonance:2, volume:.7}}));
  onStep: (step: number) => void = () => {};
  pattern!: Pattern;
  get patch() { return this.tracks[this.activeTrack].patch; }
  set patch(value: Patch) { this.tracks[this.activeTrack].patch = value; }

  async init() {
    if (!this.context) {
      const c = this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = c.createGain();
      this.master.gain.value = this.masterVolume;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 8;
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 2048;
      this.master.connect(limiter).connect(this.analyser).connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Deliberately bypass the instrument master: stopping/muting must not idle the driver.
      this.warmSource = c.createBufferSource(); this.warmSource.buffer = this.noise; this.warmSource.loop = true;
      const warmth = c.createGain(); warmth.gain.value = .00003;
      this.warmSource.connect(warmth).connect(c.destination); this.warmSource.start();
    }
    await this.context.resume();
  }
  setVolume(value: number) { this.masterVolume=value; if (this.context) this.master.gain.setTargetAtTime(value, this.context.currentTime, .02); }
  async start(steps = Infinity) {
    await this.init(); if (this.playing) return;
    this.playing = true; this.remaining = steps; this.step = 0; this.nextTime = this.context!.currentTime + .06;
    this.schedule(); this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() { this.playing = false; clearInterval(this.timer); this.generation++; this.onStep(-1); }
  async off() { this.stop(); this.warmSource?.stop(); this.warmSource = null; const c = this.context; this.context = null; this.analyser = null; await c?.close(); }
  private schedule() {
    const c = this.context!;
    while (this.nextTime < c.currentTime + .1 && this.playing && this.remaining > 0) {
      const s = this.step; const t = this.nextTime; const gen = this.generation;
      this.pattern.drums.forEach((row, i) => { if (row[s] && !this.muted[i]) this.drum(this.drumKinds[i], t, this.drumVolumes[i] ?? 1); });
      this.tracks.forEach((track,i)=>{const note=track.notes[s];if(note!==null&&!track.muted)this.bass(note,t,track.patch,track.volume);});
      window.setTimeout(() => { if (this.playing && gen === this.generation) this.onStep(s); }, Math.max(0, (t - c.currentTime) * 1000));
      this.nextTime += 60 / this.bpm / 4 * (1 + (s % 2 === 0 ? 1 : -1) * this.swing);
      this.step = (s + 1) % 16;
      this.remaining--;
    }
  }
  drum(kind: number, t = this.context?.currentTime ?? 0, volume = 1) {
    if (!this.context) return;
    const c = this.context; const gain = c.createGain(), level = c.createGain();
    level.gain.value = Math.max(0, Math.min(1, volume));
    gain.connect(level).connect(this.master);
    if (kind === 0 || kind === 3 || kind === 5 || kind === 7) {
      const o = c.createOscillator(); o.type = kind === 0 ? 'sine' : kind === 5 ? 'square' : 'triangle';
      o.frequency.setValueAtTime(kind === 0 ? 150 : kind===5?1200:kind===7?760:420, t); o.frequency.exponentialRampToValueAtTime(kind === 0 ? 42 : kind===5?800:kind===7?480:130, t + .12);
      gain.gain.setValueAtTime(kind === 0 ? .85 : .25, t); gain.gain.exponentialRampToValueAtTime(.001, t + (kind === 0 ? .35 : .16));
      o.connect(gain); o.start(t); o.stop(t + .4); o.onended = () => { o.disconnect(); gain.disconnect(); level.disconnect(); };
    } else {
      const n = c.createBufferSource(); n.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = kind===4?'bandpass':'highpass'; f.frequency.value = kind === 1 ? 1400 : kind===4?1800:7200;
      gain.gain.setValueAtTime(kind === 1 || kind===4 ? .5 : .22, t);
      if(kind===4) {for(let i=1;i<=3;i++){gain.gain.setValueAtTime(.04,t+i*.012);gain.gain.setValueAtTime(.5,t+i*.012+.004);}}
      gain.gain.exponentialRampToValueAtTime(.001, t + (kind===6?.32:kind === 1 || kind===4 ? .17 : .055));
      n.connect(f).connect(gain); n.start(t); n.stop(t + .4); n.onended = () => { n.disconnect(); f.disconnect(); gain.disconnect(); level.disconnect(); };
    }
  }
  bass(midi: number, t = this.context?.currentTime ?? 0, patch = this.patch, volume = this.tracks[this.activeTrack].volume) {
    if (!this.context) return;
    const c = this.context, p = patch, hz = 440 * 2 ** ((midi - 69) / 12);
    const o = c.createOscillator(), env = c.createGain(), filter = c.createBiquadFilter();
    o.frequency.value = hz; o.type = p.voice === 'chip' ? 'square' : p.voice === 'modular' ? 'sawtooth' : 'sine';
    filter.type = 'lowpass'; filter.Q.value = p.resonance;
    filter.frequency.setValueAtTime(Math.min(18000, p.cutoff * 2), t); filter.frequency.exponentialRampToValueAtTime(Math.max(80, p.cutoff * .4), t + p.decay);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(p.voice === 'fm' ? .5 : .24, t + .006); env.gain.exponentialRampToValueAtTime(.001, t + p.decay + .04);
    const level = c.createGain(); level.gain.value = Math.max(0, Math.min(1, volume));
    o.connect(filter).connect(env).connect(level).connect(this.master);
    const mod = c.createOscillator(), depth = c.createGain();
    mod.frequency.value = p.voice === 'modular' ? 4 + p.tone / 10 : hz * (p.voice === 'chip' ? 2 : 1);
    depth.gain.setValueAtTime(p.voice === 'modular' ? p.tone * 9 : hz * p.tone / 18, t);
    depth.gain.exponentialRampToValueAtTime(.01, t + p.decay);
    mod.connect(depth).connect(p.voice === 'modular' ? filter.frequency : o.frequency);
    o.start(t); mod.start(t); o.stop(t + p.decay + .1); mod.stop(t + p.decay + .1);
    o.onended = () => { o.disconnect(); mod.disconnect(); depth.disconnect(); env.disconnect(); filter.disconnect(); level.disconnect(); };
  }
}
