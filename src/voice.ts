import { detectPitch } from './pitch';

export class VoiceInput {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private silent: GainNode | null = null;
  private frame = 0;
  private token = 0;
  private lastFrame = 0;
  private history: number[] = [];
  private lastHeard = 0;
  note: number | null = null;
  active = false;
  onPitch: (note: number | null, frequency: number | null) => void = () => {};

  async start(context: AudioContext) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS and a supported browser.');
    const token = ++this.token;
    const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if(token !== this.token || context.state === 'closed') { stream.getTracks().forEach(track=>track.stop()); return; }
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser(); this.analyser.fftSize = 2048;
    this.silent = context.createGain(); this.silent.gain.value = 0;
    this.source.connect(this.analyser).connect(this.silent).connect(context.destination);
    this.active = true;
    stream.getAudioTracks()[0].onended = () => this.stop();
    const data = new Float32Array(this.analyser.fftSize);
    const update = (time: number) => {
      if(!this.active) return;
      if(time - this.lastFrame >= 45) {
        this.lastFrame = time;
        this.analyser!.getFloatTimeDomainData(data);
        const hz = detectPitch(data,context.sampleRate);
        if(hz !== null) {
          this.lastHeard = time;
          this.history.push(Math.round(69 + 12 * Math.log2(hz/440)));
          if(this.history.length > 3) this.history.shift();
          this.note = [...this.history].sort((a,b)=>a-b)[Math.floor(this.history.length/2)];
          this.onPitch(this.note,hz);
        } else if(time - this.lastHeard > 160) {
          this.note = null; this.history = []; this.onPitch(null,null);
        }
      }
      this.frame = requestAnimationFrame(update);
    };
    this.frame = requestAnimationFrame(update);
  }
  stop() {
    this.token++; this.active = false; cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(track=>track.stop());
    this.source?.disconnect(); this.analyser?.disconnect(); this.silent?.disconnect();
    this.stream = null; this.source = null; this.analyser = null; this.silent = null;
    this.history = []; this.note = null; this.onPitch(null,null);
  }
}
