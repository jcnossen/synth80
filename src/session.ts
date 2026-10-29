import type { SynthTrack } from './audio';
import { VOICE_IDS } from './audio.ts';

export type Session = {
  bpm: number; swing: number; root: number; activeTrack: number; masterVolume: number;
  drums: boolean[][]; drumKinds: number[]; drumVolumes: number[]; muted: boolean[];
  tracks: SynthTrack[];
};
const voices = VOICE_IDS;
const number = (v: unknown, min: number, max: number, integer = false): number => {
  if(typeof v !== 'number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v))) throw Error('Invalid tune value.');
  return v;
};
const array = (v: unknown, min: number, max: number): unknown[] => {
  if(!Array.isArray(v)||v.length<min||v.length>max) throw Error('Invalid tune structure.');
  return v;
};
const flag = (v: unknown) => { if(v!==0&&v!==1)throw Error('Invalid tune flag.');return v===1; };

const maxBytes = 45000;
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
async function transform(bytes: Uint8Array, decompress = false): Promise<Uint8Array> {
  const codec=decompress?new DecompressionStream('deflate'):new CompressionStream('deflate');
  const reader=new Blob([new Uint8Array(bytes)]).stream().pipeThrough(codec).getReader();
  const chunks: Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;
      if(size>maxBytes) {await reader.cancel();throw Error('Tune data exceeds the supported size.');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  return result;
}

export async function encodeSession(s: Session): Promise<string> {
  const packed = [s.bpm,s.swing,s.root,s.activeTrack,s.masterVolume,
    s.drums.map((row,i)=>[s.drumKinds[i],row.reduce((mask,on,step)=>mask|(on?1<<step:0),0),s.drumVolumes[i],+s.muted[i]]),
    s.tracks.map(t=>[voices.indexOf(t.patch.voice),t.patch.cutoff,t.patch.decay,t.patch.tone,t.patch.resonance,t.volume,+t.muted,t.notes])];
  const bytes=new TextEncoder().encode(JSON.stringify(packed));
  const plain='v1.'+base64(bytes);
  await decodeSession(plain); // Apply the same limits before saving and sharing.
  if(typeof CompressionStream==='undefined')return plain;
  const compressed='v2.'+base64(await transform(bytes));
  return compressed.length<plain.length?compressed:plain;
}

export async function decodeSession(token: string): Promise<Session> {
  if(token.length>60000||!/^v[12]\.[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid or unsupported tune link.');
  let bytes=Uint8Array.from(atob(token.slice(3).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  if(token.startsWith('v2.')){
    if(typeof DecompressionStream==='undefined')throw Error('Open this compressed tune in a newer browser.');
    bytes=new Uint8Array(await transform(bytes,true));
  }
  const data=array(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),7,7);
  const drums=array(data[5],0,128).map(row=>array(row,4,4));
  const tracks=array(data[6],1,128).map(row=>{
    const t=array(row,8,8);
    return {patch:{voice:voices[number(t[0],0,voices.length-1,true)],cutoff:number(t[1],80,10000),decay:number(t[2],.08,1),tone:number(t[3],0,100),resonance:number(t[4],0,18),volume:.7},
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
export async function readStoredSession(raw: string): Promise<Session> {
  if(/^v[12]\./.test(raw))return decodeSession(raw);
  const old=JSON.parse(raw);
  const tracks=old.tracks??[{notes:old.pattern.notes,patch:old.patch,muted:false,volume:1}];
  return decodeSession(await encodeSession({bpm:old.bpm,swing:old.swing,root:old.root,activeTrack:old.activeTrack??0,masterVolume:old.masterVolume??old.patch.volume??.7,
    drums:old.pattern.drums,drumKinds:old.drumKinds??old.pattern.drums.map((_:unknown,i:number)=>i%8),
    drumVolumes:old.drumVolumes??old.pattern.drums.map(()=>1),muted:old.muted??old.pattern.drums.map(()=>false),
    tracks:tracks.map((t:SynthTrack)=>({...t,volume:t.volume??1}))}));
}
