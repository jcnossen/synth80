// Keep existing IDs in order: these indices are stored in shared tunes.
export const VOICE_IDS = ['fm','chip','modular','slap','dx','finger','analog'] as const;
export type Voice = typeof VOICE_IDS[number];
export const VOICES: Record<Voice, {name:string; description:string; tone:string; scope:string}> = {
  fm:{name:'FM / Electric bass',description:'Rounded low end. Metallic harmonics. Inspired by classic Yamaha FM synthesis.',tone:'FM DEPTH',scope:'FM / SINE + SINE'},
  chip:{name:'CHIP / Pixel pulse',description:'Square waves and electric nostalgia. A tiny arcade inside your browser.',tone:'CHIP EDGE',scope:'CHIP / SQUARE'},
  modular:{name:'MOD / Acid circuit',description:'Moving filters and resonant edges. A patch-cable state of mind.',tone:'LFO DEPTH',scope:'MOD / SAW + LFO'},
  slap:{name:'SLAP / Sitcom funk',description:'A sharp string snap, bright pop and rounded body. Synthesized slap bass with a Seinfeld-like funk character.',tone:'SLAP SNAP',scope:'SLAP / STRING + SNAP'},
  dx:{name:'DX / 80s keyboard bass',description:'Punchy, woody FM attack with a clean low end. Inspired by vintage Yamaha keyboard bass patches.',tone:'FM BITE',scope:'DX / DUAL FM'},
  finger:{name:'FINGER / Warm electric',description:'A soft pluck, mellow harmonics and rounded sustain. For laid-back grooves and walking lines.',tone:'PLUCK EDGE',scope:'FINGER / BODY + PLUCK'},
  analog:{name:'ANALOG / Detuned sub',description:'Two detuned saws, a solid sub oscillator and a closing filter. Thick vintage synth bass.',tone:'DETUNE',scope:'ANALOG / DUAL SAW + SUB'},
};
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
    if(['slap','dx','finger','analog'].includes(patch.voice)) { this.characterBass(midi,t,patch,volume);return; }
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

  private characterBass(midi:number,t:number,p:Patch,volume:number) {
    const c=this.context!,hz=440*2**((midi-69)/12),tone=p.tone/100;
    const duration=p.decay+.12, end=t+duration;
    const nodes:AudioNode[]=[],sources:(OscillatorNode|AudioBufferSourceNode)[]=[];
    const gain=(value:number)=>{const g=c.createGain();g.gain.value=value;nodes.push(g);return g;};
    const osc=(ratio:number,type:OscillatorType='sine')=>{const o=c.createOscillator();o.type=type;o.frequency.value=Math.min(hz*ratio,c.sampleRate*.45);nodes.push(o);sources.push(o);return o;};
    const envelope=(peak:number,decay:number,attack=.003)=>{
      const g=gain(0);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+attack);
      g.gain.exponentialRampToValueAtTime(.00001,t+Math.max(attack+.005,decay));
      g.gain.setValueAtTime(0,end);return g;
    };
    const level=gain(Math.max(0,Math.min(1,volume)));level.connect(this.master);
    const filter=c.createBiquadFilter();nodes.push(filter);filter.type='lowpass';filter.Q.value=Math.min(p.resonance,12);
    filter.frequency.setValueAtTime(Math.min(c.sampleRate*.45,Math.max(100,p.cutoff)*(p.voice==='slap'?2.5:1.8)),t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(70,p.cutoff*(p.voice==='analog'?.15:.4)),t+p.decay);
    filter.connect(level);
    if(p.voice==='analog') {
      const amp=envelope(.16,duration-.02,.008);amp.connect(filter);
      for(const direction of [-1,1]) {const o=osc(1,'sawtooth');o.detune.value=direction*(2+tone*16);o.connect(amp);}
      osc(.5).connect(envelope(.23,duration-.02,.008)).connect(filter);
    } else {
      const slap=p.voice==='slap',dx=p.voice==='dx';
      const body=osc(1,dx?'sine':'triangle');
      // A brief downward pitch motion gives the slap its struck-string attack.
      if(slap){body.frequency.setValueAtTime(Math.min(hz*(1.025+tone*.045),c.sampleRate*.45),t);body.frequency.exponentialRampToValueAtTime(Math.min(hz,c.sampleRate*.45),t+.028);}
      body.connect(envelope(dx?.42:slap?.3:.34,duration-.02)).connect(filter);
      const mod=osc(dx?1:2),depth=gain(0);
      depth.gain.setValueAtTime(hz*(dx?(1+tone*5):slap?(1+tone*7):(.12+tone*.8)),t);
      depth.gain.exponentialRampToValueAtTime(.01,t+(slap?.055:dx?.1:.065)+p.decay*.12);
      mod.connect(depth).connect(body.frequency);
      const overtone=osc(dx?2:slap?3:2),edge=envelope(dx?.17:slap?.16:.075,Math.min(duration-.02,.06+p.decay*.55));
      overtone.connect(edge).connect(filter);
      if(dx){const bright=osc(3),index=gain(0);index.gain.setValueAtTime(hz*(1+tone*6),t);index.gain.exponentialRampToValueAtTime(.01,t+.045+p.decay*.15);bright.connect(index).connect(overtone.frequency);}
      if(slap){
        const snap=c.createBufferSource();snap.buffer=this.noise;nodes.push(snap);sources.push(snap);
        const band=c.createBiquadFilter();nodes.push(band);band.type='bandpass';band.frequency.value=1800+tone*3500;band.Q.value=.8;
        snap.connect(band).connect(envelope(.09+tone*.2,.012+tone*.018,.001)).connect(filter);
        osc(1).connect(envelope(.17,duration-.02)).connect(filter);
      }
    }
    for(const source of sources){source.start(t);source.stop(end);}
    // All sources end together; one callback releases the complete voice graph.
    sources[0].onended=()=>{for(const node of nodes)node.disconnect();};
  }
}
