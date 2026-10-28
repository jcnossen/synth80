import type { SynthTrack, Voice } from './audio';

export type Session = {
  bpm: number; swing: number; root: number; activeTrack: number; masterVolume: number;
  drums: boolean[][]; drumKinds: number[]; drumVolumes: number[]; muted: boolean[];
  tracks: SynthTrack[];
};
const voices: Voice[] = ['fm','chip','modular'];
const number = (v: unknown, min: number, max: number, integer = false): number => {
  if(typeof v !== 'number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v))) throw Error('Invalid tune value.');
  return v;
};
const array = (v: unknown, min: number, max: number): unknown[] => {
  if(!Array.isArray(v)||v.length<min||v.length>max) throw Error('Invalid tune structure.');
  return v;
};
const flag = (v: unknown) => { if(v!==0&&v!==1)throw Error('Invalid tune flag.');return v===1; };

export function encodeSession(s: Session): string {
  const packed = [s.bpm,s.swing,s.root,s.activeTrack,s.masterVolume,
    s.drums.map((row,i)=>[s.drumKinds[i],row.reduce((mask,on,step)=>mask|(on?1<<step:0),0),s.drumVolumes[i],+s.muted[i]]),
    s.tracks.map(t=>[voices.indexOf(t.patch.voice),t.patch.cutoff,t.patch.decay,t.patch.tone,t.patch.resonance,t.volume,+t.muted,t.notes])];
  const token='v1.'+btoa(JSON.stringify(packed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  decodeSession(token); // Apply the same limits before saving and sharing.
  return token;
}

export function decodeSession(token: string): Session {
  if(token.length>60000||!/^v1\.[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid or unsupported tune link.');
  const data=array(JSON.parse(atob(token.slice(3).replaceAll('-','+').replaceAll('_','/'))),7,7);
  const drums=array(data[5],0,128).map(row=>array(row,4,4));
  const tracks=array(data[6],1,128).map(row=>{
    const t=array(row,8,8);
    return {patch:{voice:voices[number(t[0],0,2,true)],cutoff:number(t[1],80,10000),decay:number(t[2],.08,1),tone:number(t[3],0,100),resonance:number(t[4],0,18),volume:.7},
      volume:number(t[5],0,1),muted:flag(t[6]),notes:array(t[7],16,16).map(n=>n===null?null:number(n,0,127,true))};
  });
  return {bpm:number(data[0],50,220),swing:number(data[1],0,.6),root:number(data[2],0,11,true),activeTrack:number(data[3],0,tracks.length-1,true),masterVolume:number(data[4],0,1),tracks,
    drums:drums.map(d=>{const mask=number(d[1],0,65535,true);return Array.from({length:16},(_,i)=>!!(mask&(1<<i)));}),
    drumKinds:drums.map(d=>number(d[0],0,7,true)),drumVolumes:drums.map(d=>number(d[2],0,1)),muted:drums.map(d=>flag(d[3]))};
}

export function readCookie(): string | null {
  return document.cookie.split('; ').find(cookie=>cookie.startsWith('synth80_tune='))?.slice('synth80_tune='.length)??null;
}
export function saveCookie(token: string): boolean {
  const options='; Path=/synth/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  if(token.length>3800) {document.cookie='synth80_tune=; Max-Age=0'+options;return false;}
  document.cookie='synth80_tune='+token+'; Max-Age=31536000'+options;
  return readCookie()===token;
}

/** Migrate sessions saved before compact cookie/link serialization was introduced. */
export function readStoredSession(raw: string): Session {
  if(raw.startsWith('v1.'))return decodeSession(raw);
  const old=JSON.parse(raw);
  const tracks=old.tracks??[{notes:old.pattern.notes,patch:old.patch,muted:false,volume:1}];
  return decodeSession(encodeSession({bpm:old.bpm,swing:old.swing,root:old.root,activeTrack:old.activeTrack??0,masterVolume:old.masterVolume??old.patch.volume??.7,
    drums:old.pattern.drums,drumKinds:old.drumKinds??old.pattern.drums.map((_:unknown,i:number)=>i%8),
    drumVolumes:old.drumVolumes??old.pattern.drums.map(()=>1),muted:old.muted??old.pattern.drums.map(()=>false),
    tracks:tracks.map((t:SynthTrack)=>({...t,volume:t.volume??1}))}));
}
