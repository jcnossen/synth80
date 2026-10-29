import assert from 'node:assert/strict';
import audio from 'web-audio-engine';
import { Engine, VOICE_IDS } from '../src/audio.ts';

async function render(voice, {volume=1, tone=40, midi=36, decay=.28, cutoff=2800, resonance=2}={}) {
  const rate=44100,context=new audio.OfflineAudioContext(1,rate*2,rate);
  const engine=new Engine();engine.context=context;engine.master=context.destination;
  engine.noise=context.createBuffer(1,rate,rate);
  let seed=12345;
  const noise=engine.noise.getChannelData(0);
  for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=(seed/4294967296)*2-1;}
  engine.bass(midi,.02,{voice,cutoff,decay,tone,resonance,volume:.7},volume);
  return (await context.startRendering()).getChannelData(0);
}
const rms=data=>Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);
const outputs=[];
for(const voice of VOICE_IDS) {
  const full=await render(voice),quiet=await render(voice,{volume:.25}),silent=await render(voice,{volume:0});
  assert.ok(full.every(Number.isFinite),voice+' has finite output');
  const energy=rms(full);assert.ok(energy>.001,voice+' is audible');
  assert.ok(Math.abs(rms(quiet)/energy-.25)<.001,voice+' respects track volume');
  assert.equal(rms(silent),0,voice+' can be silenced');
  assert.ok(rms(full.slice(44100))<.000001,voice+' releases fully');
  if(['slap','dx','finger','analog'].includes(voice)) {
    const bright=await render(voice,{tone:90});
    assert.ok(rms(bright.map((v,i)=>v-full[i]))>.001,voice+' tone control changes sound');
    for(const midi of [24,60]) {
      const edge=await render(voice,{midi,decay:.08,cutoff:10000,resonance:18,tone:100});
      assert.ok(edge.every(Number.isFinite),voice+' stays finite at extreme settings');
    }
  }
  outputs.push(full);
  console.log(voice+': rendered, volume-scaled and released correctly (RMS '+energy.toFixed(4)+').');
}
for(let i=0;i<outputs.length;i++)for(let j=0;j<i;j++) {
  assert.ok(rms(outputs[i].map((v,k)=>v-outputs[j][k]))>.001,'Each engine has a distinct waveform');
}
console.log('All seven engines passed offline audio-render checks.');
