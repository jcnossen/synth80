import './style.css';
import { encodeSession, decodeSession, readStoredSession, readCookie, saveCookie, type Session } from './session';
import { pianoKeys, midiForKey, transposeNotes } from './keyboard';
import { Engine, type Pattern, type Voice } from './audio';

const engine = new Engine();
const names = ['KICK', 'SNARE', 'HI-HAT', 'TOM', 'CLAP', 'RIM', 'OPEN HAT', 'PERC'];
const drumIcons = [
  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  '<path d="M4 8h16v8H4zM7 8l3 8m1-8 3 8m1-8 3 8"/>',
  '<path d="M3 10h18M5 14h14M12 4v16"/>',
  '<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v9c0 4 16 4 16 0V7"/>',
  '<path d="m4 15 4-5 4 5 4-5 4 5M6 5l2 2m4-4v3m6-1-2 2"/>',
  '<circle cx="12" cy="12" r="8"/><path d="m4 4 16 16"/>',
  '<path d="m3 8 9-3 9 3M3 15l9 3 9-3M12 3v18"/>',
  '<path d="m12 3 9 9-9 9-9-9Z"/>'
].map(paths => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);

const notes = [36, 38, 39, 41, 43, 46, 48];
let root = 0;
let pattern: Pattern = { drums: [ [0,4,8,10,12], [4,12], [0,2,4,6,8,10,12,14], [7,15] ].map(hits => Array.from({length:16}, (_, i) => hits.includes(i))), notes: [36,null,36,48,null,39,null,43,36,null,46,43,null,39,38,null] };
engine.pattern = pattern;
engine.tracks[0].notes = pattern.notes;
let selected = -1;
const noteName = (n: number) => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n % 12] + (Math.floor(n / 12) - 1);
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
document.querySelector('#app')!.innerHTML = `
<header><a class="brand" href="#">SYNTH<span>80</span><i></i></a><div class="header-label">INDEPENDENT SOUND MACHINE</div><button id="power" class="status"><i></i><span>ENABLE AUDIO</span></button></header>
<main><section class="intro"><div><div class="eyebrow">YOUR BROWSER. YOUR STUDIO.</div><h1>Small machine.<br><span>Endless grooves.</span></h1></div><div class="intro-right"><p>Sequence a beat. Shape a bassline.<br>Find the sound in between.</p><span class="tag">FM / CHIPTUNE / MODULAR</span></div></section>
<section class="machine"><div class="machine-top"><div class="model">S80 <span>GROOVE WORKSTATION</span></div><div class="screws">＋ <span>＋</span></div></div>
<section class="transport"><div class="transport-buttons"><button id="play" class="play">▶ <span>PLAY</span></button><button id="stop" class="stop" aria-label="Stop playback">■</button></div><label class="tempo">TEMPO <div><input id="bpm" type="number" min="50" max="220" value="112"><span>BPM</span></div></label><label class="swing">SWING <output id="swing-value">0%</output><input id="swing" type="range" min="0" max="60" value="0"></label><div class="transport-end"><span id="position">01 <small>/ 16</small></span><div class="leds">● ● ● ●</div></div></section>
<section class="sequencer"><div class="section-heading"><h2><span>01</span> RHYTHM SEQUENCER</h2><div class="section-actions"><span>16 STEPS</span><button id="clear">CLEAR</button></div></div><div class="grid-scroll"><div class="step-numbers"><span></span>${Array.from({length:16},(_,i)=>`<span>${String(i+1).padStart(2,'0')}</span>`).join('')}</div><div id="drums"></div></div><div class="add-drum"><label for="drum-kind">NEW DRUM</label><select id="drum-kind">${names.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select><button id="add-drum">+ ADD DRUM TRACK</button></div><div class="sequence-footer"><span><i class="tiny-dot"></i> TAP A STEP ? SWIPE FOR MORE</span><span>4 / 4 &nbsp; · &nbsp; 1/16</span></div></section>
<section class="bass-section"><div class="section-heading"><h2><span>02</span> SYNTH TRACKS</h2><span class="live-label">● POLYPHONIC ENGINE</span></div><div class="track-selector" aria-label="Synth tracks"></div><div class="track-actions"><button id="add-synth">+ ADD SYNTH TRACK</button><button id="synth-mute" aria-pressed="false">MUTE TRACK</button></div><label class="synth-volume" for="synth-volume"><span>TRACK VOLUME</span><input id="synth-volume" type="range" min="0" max="100" step="1" value="100"><output id="synth-volume-value">100%</output></label><div class="synth-layout"><div class="patch-panel"><label class="field-label" for="voice">SOUND ENGINE</label><select id="voice"><option value="fm">01 — FM / Electric bass</option><option value="chip">02 — CHIP / Pixel pulse</option><option value="modular">03 — MOD / Acid circuit</option></select><p id="voice-description">Rounded low end. Metallic harmonics.<br>Inspired by classic Yamaha FM synthesis.</p><div class="scope"><canvas id="scope"></canvas><span id="scope-label">FM · SINE / SINE</span><b>OUTPUT</b></div></div><div class="controls">${[
['cutoff','CUTOFF','80','10000','2800','Hz'],['tone','FM DEPTH','0','100','40','%'],['decay','DECAY','8','100','28','ms'],['resonance','RESONANCE','0','18','2','Q']
].map(([id,label,min,max,value,unit])=>`<label class="knob-control"><span id="${id}-label">${label}</span><div class="dial" id="${id}-dial"><i></i></div><input id="${id}" aria-label="${label}" type="range" min="${min}" max="${max}" value="${value}"><output id="${id}-value">${value}${unit}</output></label>`).join('')}</div></div><div class="bass-heading"><span>NOTE PATTERN <small>SELECT STEP / TYPE NOTE / BACKSPACE: REST</small></span><label>KEY <select id="key">${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'].map((x,i)=>`<option value="${i}">${x} minor</option>`).join('')}</select></label></div><div class="transpose-controls"><label for="transpose-target">TRANSPOSE<select id="transpose-target"><option value="pattern">Whole pattern</option><option value="step">Selected note</option></select></label><div class="transpose-group"><span>SEMITONE</span><button data-transpose="-1" aria-label="Transpose down one semitone">-1</button><button data-transpose="1" aria-label="Transpose up one semitone">+1</button></div><div class="transpose-group"><span>OCTAVE</span><button data-transpose="-12" aria-label="Transpose down one octave">-12</button><button data-transpose="12" aria-label="Transpose up one octave">+12</button></div></div><div id="bass" class="bass-grid"></div><section class="keyboard-area"><div class="keyboard-caption"><span>PLAY / ENTER NOTES</span><small>SELECT A STEP, THEN TAP A KEY / BACKSPACE: REST</small></div><div class="keyboard">${Array.from({length:13},(_,i)=>`<button class="piano-key ${[1,3,6,8,10].includes(i)?'black':'white'}" data-midi="${36+i}" aria-label="Play ${noteName(36+i)}"><span><b>${noteName(36+i)}</b><small>${pianoKeys[i]}</small></span></button>`).join('')}</div></section><div id="note-editor" hidden><span>STEP <b id="edit-step"></b></span>${notes.map(n=>`<button data-note="${n}">${noteName(n)}</button>`).join('')}<button data-note="rest">REST</button><button id="close-editor" aria-label="Close note editor">✕</button></div></section>
<section class="bottom-panel"><div><h2><span>03</span> HAPPY ACCIDENTS</h2><p>A little randomness. A new starting point.</p></div><button id="generate" class="generate">✧ &nbsp; GENERATE GROOVE <span>↗</span></button><label class="master">MASTER <output id="volume-value">70%</output><input id="volume" type="range" min="0" max="100" value="70"></label></section>

<div class="machine-foot"><span>SYNTH80 — BUILT FOR THE MOMENT</span><span>WEB AUDIO · NO SAMPLES · ALL SYNTHESIS</span></div></section>
<footer><span><i class="tiny-dot"></i> MADE TO MAKE SOME NOISE.</span><div><button id="save">SAVE SESSION</button><button id="load">LOAD SESSION</button><button id="share">SHARE TUNE</button><button id="export">EXPORT WAV ↗</button></div></footer><div id="share-panel" hidden><label for="share-link">SHAREABLE TUNE LINK</label><div><input id="share-link" type="text" readonly spellcheck="false"><button id="copy-link">COPY LINK</button><button id="close-share" aria-label="Close share link">CLOSE</button></div><p>Includes all tracks, notes, sound settings and mixer levels. Open the link and press Play.</p></div><p id="message" role="status">Enable audio once to keep your sound driver warm, even when stopped.</p></main>`;

function render() {
  engine.tracks[engine.activeTrack].notes = pattern.notes;
  $('#drums').innerHTML = pattern.drums.map((row,r)=>`<div class="drum-row row-${engine.drumKinds[r]}"><div class="drum-track-controls"><button class="track ${engine.muted[r]?'muted':''}" data-mute="${r}" aria-pressed="${engine.muted[r]}" title="Mute ${names[engine.drumKinds[r]]}"><i></i>${names[engine.drumKinds[r]]}<span>${drumIcons[engine.drumKinds[r]] ?? drumIcons[0]}</span></button><label class="drum-level"><input type="range" min="0" max="100" step="1" value="${Math.round((engine.drumVolumes[r] ?? 1)*100)}" data-drum-volume="${r}" aria-label="${names[engine.drumKinds[r]]} track ${r+1} volume"><output id="drum-volume-${r}">${Math.round((engine.drumVolumes[r] ?? 1)*100)}%</output></label></div>${row.map((on,s)=>`<button class="step ${on?'active':''} ${s%4===0?'beat':''}" data-row="${r}" data-step="${s}" aria-label="${names[engine.drumKinds[r]]} step ${s+1}" aria-pressed="${on}"><i></i></button>`).join('')}</div>`).join('');
  $('#bass').innerHTML = pattern.notes.map((n,i)=>`<button class="bass-step ${i===selected?'selected':''} ${n!==null?'active':''}" data-bass="${i}" aria-label="Step ${i+1}: ${n===null?'rest':noteName(n)}" title="Step ${i+1}: ${n===null?'rest':noteName(n)}"><small>${String(i+1).padStart(2,'0')}</small><span>${n===null?'—':noteName(n)}</span><i style="height:${n===null?3:12+(n%12)*2}px"></i></button>`).join('');
}
render();
function message(text: string) { $('#message').textContent = text; }
async function ready() { await engine.init(); $('#power').classList.add('enabled'); $('#power span').textContent = 'AUDIO ON · OFF'; }
async function toggle() { try { if(engine.playing) stop(); else { await ready(); await engine.start(); $('#play').classList.add('playing'); $('#play span').textContent='PLAYING'; } } catch { message('Audio could not start. Try enabling audio again.'); } }
function stop() {  engine.stop(); $('#play').classList.remove('playing'); $('#play span').textContent='PLAY'; }
$('#play').onclick = toggle; $('#stop').onclick = stop;
$('#power').onclick = async () => { if(engine.context) { stop(); await engine.off(); $('#power').classList.remove('enabled'); $('#power span').textContent='ENABLE AUDIO'; message('Audio device released.'); } else { await ready(); message('Audio ready. A very quiet noise signal keeps the driver awake while stopped.'); } };
$('#drums').onclick = e => { const el=(e.target as HTMLElement).closest<HTMLElement>('button'); if(!el)return; if(el.dataset.mute!==undefined) engine.muted[+el.dataset.mute]=!engine.muted[+el.dataset.mute]; else {const r=+el.dataset.row!,s=+el.dataset.step!;pattern.drums[r][s]=!pattern.drums[r][s];} render(); };
$('#bass').onclick = e => { const el=(e.target as HTMLElement).closest<HTMLElement>('[data-bass]'); if(!el)return; selected=+el.dataset.bass!; $('#edit-step').textContent=String(selected+1); $('#note-editor').hidden=false; document.querySelectorAll('[data-bass]').forEach(step=>step.classList.toggle('selected',step===el)); };
$('#bass').oncontextmenu = e => {const el=(e.target as HTMLElement).closest<HTMLElement>('[data-bass]'); if(el){e.preventDefault();pattern.notes[+el.dataset.bass!]=null;render();}};
$('#note-editor').onclick = async e => {const el=(e.target as HTMLElement).closest<HTMLElement>('[data-note]');if(!el||selected<0)return; const n=el.dataset.note==='rest'?null:+el.dataset.note!+root;pattern.notes[selected]=n;render();if(n!==null){await ready();engine.bass(n);}};
$('#close-editor').onclick=()=>{$('#note-editor').hidden=true;selected=-1;render();};
$('#clear').onclick=()=>{pattern.drums=pattern.drums.map(()=>Array(16).fill(false));render();};
$('#generate').onclick=()=>{pattern.drums=pattern.drums.map((_,r)=>Array.from({length:16},(_,i)=>r===0?(i%4===0||Math.random()<.12):r===1?(i===4||i===12):r===2?(i%2===0||Math.random()<.3):Math.random()<.12));pattern.notes=Array.from({length:16},(_,i)=>i===0?36+root:Math.random()<.3?null:notes[Math.floor(Math.random()*notes.length)]+root);render();message('Fresh groove generated in '+$('#key option:checked').textContent+'.');};
$('#key').onchange=()=>{const value=+$('#key').querySelector<HTMLOptionElement>('option:checked')!.value;pattern.notes=pattern.notes.map(n=>n===null?null:n-root+value);root=value;document.querySelectorAll<HTMLElement>('[data-note]').forEach(el=>{if(el.dataset.note!=='rest')el.textContent=noteName(+el.dataset.note!+root);});render();};
$('#bpm').onchange=()=>{const el=$<HTMLInputElement>('#bpm');engine.bpm=Math.min(220,Math.max(50,Number(el.value)||112));el.value=String(engine.bpm);};
$('#swing').oninput=()=>{const value=+$<HTMLInputElement>('#swing').value;engine.swing=value/100;$('#swing-value').textContent=value+'%';};
function setControl(id:string) {const v=+$<HTMLInputElement>('#'+id).value; if(id==='volume'){engine.setVolume(v/100);$('#volume-value').textContent=v+'%';return;} if(id==='cutoff')engine.patch.cutoff=v;if(id==='tone')engine.patch.tone=v;if(id==='decay')engine.patch.decay=v/100;if(id==='resonance')engine.patch.resonance=v;$('#'+id+'-value').textContent=id==='cutoff'?(v/1000).toFixed(1)+' kHz':id==='decay'?v*10+' ms':id==='tone'?v+'%':v.toFixed(1)+' Q';const input=$<HTMLInputElement>('#'+id);$('#'+id+'-dial').style.setProperty('--rotation',(-135+(v-+input.min)/(+input.max-+input.min)*270)+'deg');}
['cutoff','tone','decay','resonance','volume'].forEach(id=>{$('#'+id).oninput=()=>setControl(id);setControl(id);});
$('#voice').onchange=()=>{engine.patch.voice=$<HTMLSelectElement>('#voice').value as Voice;const v=engine.patch.voice;$('#voice-description').innerHTML=v==='fm'?'Rounded low end. Metallic harmonics.<br>Inspired by classic Yamaha FM synthesis.':v==='chip'?'Square waves. Electric nostalgia.<br>A tiny arcade inside your browser.':'Moving filters. Resonant edges.<br>A patch-cable state of mind.';$('#tone-label').textContent=v==='modular'?'LFO DEPTH':v==='chip'?'CHIP EDGE':'FM DEPTH';$('#scope-label').textContent=v==='fm'?'FM · SINE / SINE':v==='chip'?'CHIP · SQUARE':'MOD · SAW / LFO';};
engine.onStep=s=>{document.querySelectorAll('.current').forEach(e=>e.classList.remove('current'));if(s>=0){document.querySelectorAll(`[data-step="${s}"], [data-bass="${s}"]`).forEach(e=>e.classList.add('current'));$('#position').innerHTML=String(s+1).padStart(2,'0')+' <small>/ 16</small>';}else $('#position').innerHTML='01 <small>/ 16</small>';};
async function audition(midi:number) {if(selected>=0&&!$('#note-editor').hidden){pattern.notes[selected]=midi;render();}await ready();engine.bass(midi);const el=$(`[data-midi="${midi}"]`);el.classList.add('pressed');setTimeout(()=>el.classList.remove('pressed'),160);}
const touches = new Map<number, number>();
$('.keyboard').onpointerdown=e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-midi]');if(el){e.preventDefault();touches.set(e.pointerId,+el.dataset.midi!);$('.keyboard').setPointerCapture(e.pointerId);void audition(+el.dataset.midi!).catch(()=>message('Tap Enable audio to resume sound.'));}};
$('.keyboard').onpointermove=e=>{if(!touches.has(e.pointerId))return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-midi]');if(el&&touches.get(e.pointerId)!==+el.dataset.midi!){touches.set(e.pointerId,+el.dataset.midi!);void audition(+el.dataset.midi!).catch(()=>message('Tap Enable audio to resume sound.'));}};
$('.keyboard').onpointerup=$('.keyboard').onpointercancel=e=>{touches.delete(e.pointerId);};
// Phone browsers suspend audio/timers when backgrounded. Avoid a burst of overdue notes.
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(engine.playing){stop();message('Playback paused while the app was in the background. Tap Play to resume.');}}});
window.onkeydown=e=>{
  const target=e.target as HTMLElement;
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;
  const editing=selected>=0&&!$('#note-editor').hidden;
  if((e.key==='Backspace'||e.key==='Delete')&&editing){
    e.preventDefault();pattern.notes[selected]=null;render();$<HTMLButtonElement>(`[data-bass="${selected}"]`).focus({preventScroll:true});return;
  }
  if(e.code==='Space'){e.preventDefault();void toggle();return;}
  const midi=midiForKey(e.key);
  if(midi!==null){
    e.preventDefault();
    void audition(midi).catch(()=>message('Tap Enable audio to resume sound.'));
  }
};
const canvas=$<HTMLCanvasElement>('#scope'), ctx=canvas.getContext('2d')!, wave=new Uint8Array(2048);
function draw(){canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;const w=canvas.width,h=canvas.height;ctx.strokeStyle='#253e38';ctx.lineWidth=1;for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);ctx.stroke();}ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();engine.analyser?.getByteTimeDomainData(wave);ctx.strokeStyle='#a9e3bc';ctx.lineWidth=1.5*devicePixelRatio;ctx.beginPath();for(let x=0;x<w;x++){const value=engine.analyser?(wave[Math.floor(x/w*2048)]-128)/128:0;const y=h/2+value*h*.42;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();requestAnimationFrame(draw);}draw();
$('#export').onclick=async()=>{if(!engine.context){await ready();}const c=engine.context!;const dest=c.createMediaStreamDestination();engine.analyser!.connect(dest);if(typeof MediaRecorder==='undefined'){message('Recording is unavailable in this browser.');engine.analyser!.disconnect(dest);return;}const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime){message('Recording is unavailable in this browser.');engine.analyser!.disconnect(dest);return;}message('Recording one loop…');const chunks:Blob[]=[];const recorder=new MediaRecorder(dest.stream,{mimeType:mime});const button=$<HTMLButtonElement>('#export');button.disabled=true;stop();recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{try{const data=await new Blob(chunks).arrayBuffer();const buffer=await c.decodeAudioData(data);const length=buffer.length,channels=buffer.numberOfChannels;const bytes=new ArrayBuffer(44+length*channels*2),view=new DataView(bytes);const str=(o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};str(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,length*channels*2,true);for(let i=0;i<length;i++)for(let ch=0;ch<channels;ch++)view.setInt16(44+(i*channels+ch)*2,Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]))*32767,true);const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const a=document.createElement('a');a.href=url;a.download='synth80-groove.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);message('WAV exported with the release tail.');}catch{message('Could not encode recording. Try again.');}finally{button.disabled=false;dest.stream.getTracks().forEach(t=>t.stop());try{engine.analyser?.disconnect(dest);}catch{}}};recorder.start();await engine.start(16);$('#play').classList.add('playing');$('#play span').textContent='PLAYING';setTimeout(()=>{stop();setTimeout(()=>recorder.stop(),Math.max(600,engine.patch.decay*1000+150));},60/engine.bpm*4*1000+60);};


function updateTrackButtons() {
  const volume=Math.round(engine.tracks[engine.activeTrack].volume*100);
  $<HTMLInputElement>('#synth-volume').value=String(volume);$('#synth-volume-value').textContent=volume+'%';
  $('.track-selector').innerHTML=engine.tracks.map((track,i)=>`<button data-synth="${i}" aria-pressed="${i===engine.activeTrack}" class="${i===engine.activeTrack?'selected':''} ${track.muted?'muted':''}">${String(i+1).padStart(2,'0')} ? ${i===0?'BASS':'SYNTH '+(i+1)}</button>`).join('');
  document.querySelectorAll<HTMLElement>('[data-synth]').forEach(el=>{const active=Number(el.dataset.synth)===engine.activeTrack;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));el.classList.toggle('muted',engine.tracks[+el.dataset.synth!].muted);});
  const muted=engine.tracks[engine.activeTrack].muted;
  $('#synth-mute').textContent=muted?'UNMUTE TRACK':'MUTE TRACK';$('#synth-mute').setAttribute('aria-pressed',String(muted));
}
$('.track-selector').onclick=e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-synth]');if(!el)return;
  engine.activeTrack=+el.dataset.synth!;pattern.notes=engine.tracks[engine.activeTrack].notes;
  const patch=engine.patch;
  for(const [id,v] of Object.entries({voice:patch.voice,cutoff:patch.cutoff,tone:patch.tone,decay:patch.decay*100,resonance:patch.resonance}))$<HTMLInputElement>('#'+id).value=String(v);
  ['cutoff','tone','decay','resonance'].forEach(setControl);$('#voice').dispatchEvent(new Event('change'));$('#note-editor').hidden=true;selected=-1;render();updateTrackButtons();
};
$('#synth-mute').onclick=()=>{engine.tracks[engine.activeTrack].muted=!engine.tracks[engine.activeTrack].muted;updateTrackButtons();};

$('#add-synth').onclick=()=>{
  engine.tracks.push({notes:Array(16).fill(null),patch:{...engine.patch},muted:false,volume:1});
  updateTrackButtons();
  $<HTMLButtonElement>(`[data-synth="${engine.tracks.length-1}"]`).click();
  message('Synth track '+engine.tracks.length+' added. Enter notes with the keyboard or generate a groove.');
};
$('#add-drum').onclick=()=>{
  const kind=+$<HTMLSelectElement>('#drum-kind').value;
  pattern.drums.push(Array(16).fill(false));engine.drumKinds.push(kind);engine.muted.push(false);engine.drumVolumes.push(1);render();
  message(names[kind]+' track added. Tap steps to sequence it.');
};
updateTrackButtons();

$('#drums').oninput=e=>{
  const input=e.target as HTMLInputElement;
  if(input.dataset.drumVolume===undefined)return;
  const track=Number(input.dataset.drumVolume),volume=Number(input.value);
  engine.drumVolumes[track]=volume/100;
  $('#drum-volume-'+track).textContent=volume+'%';
};

$('#synth-volume').oninput=()=>{
  const value=Number($<HTMLInputElement>('#synth-volume').value);
  engine.tracks[engine.activeTrack].volume=value/100;
  $('#synth-volume-value').textContent=value+'%';
};

function currentSession(): Session {
  return {bpm:engine.bpm,swing:engine.swing,root,activeTrack:engine.activeTrack,masterVolume:engine.masterVolume,
    drums:pattern.drums,drumKinds:engine.drumKinds,drumVolumes:engine.drumVolumes,muted:engine.muted,tracks:engine.tracks};
}
function applySession(s: Session) {
  stop();
  engine.tracks=s.tracks;engine.activeTrack=s.activeTrack;
  pattern={drums:s.drums,notes:engine.tracks[s.activeTrack].notes};engine.pattern=pattern;
  engine.bpm=s.bpm;engine.swing=s.swing;root=s.root;
  engine.drumKinds=s.drumKinds;engine.drumVolumes=s.drumVolumes;engine.muted=s.muted;
  const p=engine.patch;
  for(const [id,v] of Object.entries({bpm:s.bpm,swing:s.swing*100,key:s.root,voice:p.voice,cutoff:p.cutoff,tone:p.tone,decay:p.decay*100,resonance:p.resonance,volume:s.masterVolume*100})) $<HTMLInputElement>('#'+id).value=String(v);
  ['cutoff','tone','decay','resonance','volume'].forEach(setControl);
  $('#swing-value').textContent=Math.round(s.swing*100)+'%';
  $('#voice').dispatchEvent(new Event('change'));$('#key').dispatchEvent(new Event('change'));
  selected=-1;$('#note-editor').hidden=true;render();updateTrackButtons();
}
$('#save').onclick=async()=>{
  try {
    const token=await encodeSession(currentSession());let local=false,cookie=false;
    try {localStorage.setItem('synth80-session',token);local=true;}catch{}
    try {cookie=saveCookie(token);}catch{}
    message(cookie?'Tune saved in a cookie for up to one year'+(local?' and in browser storage.':'.'):
      local?(token.length>3800?'Tune saved in browser storage. It is too large for a cookie; Share tune still works.':'Tune saved in browser storage; cookies are unavailable.'):
      'Browser saving is unavailable. Use Share tune to keep a copy.');
  }catch {message('This tune could not be saved: its data or size is unsupported.');}
};
async function restoreSaved(): Promise<boolean> {
  const candidates:string[]=[];
  try{const raw=localStorage.getItem('synth80-session');if(raw)candidates.push(raw);}catch{}
  try{const cookie=readCookie();if(cookie)candidates.push(cookie);}catch{}
  for(const raw of candidates){try{applySession(await readStoredSession(raw));return true;}catch{}}
  return false;
}
$('#load').onclick=async()=>message(await restoreSaved()?'Saved tune restored. Press Play when ready.':'No readable saved tune was found.');
$('#share').onclick=async()=>{
  try {
    const url=new URL(location.href);url.hash='tune='+await encodeSession(currentSession());
    $<HTMLInputElement>('#share-link').value=url.href;$('#share-panel').hidden=false;
    $<HTMLInputElement>('#share-link').select();
    message('Share link created. Copy it to share this exact tune.');
    $('#share-panel').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch{message('Could not create a share link: the tune is too large or contains invalid data.');}
};
$('#copy-link').onclick=async()=>{
  const input=$<HTMLInputElement>('#share-link');
  try{await navigator.clipboard.writeText(input.value);message('Tune link copied!');}
  catch{input.focus();input.select();message('Copy the selected link with your browser Copy command.');}
};
$('#share-link').onclick=()=>{$<HTMLInputElement>('#share-link').select();};
$('#close-share').onclick=()=>{$('#share-panel').hidden=true;};
async function restoreLink(): Promise<boolean> {
  const token=new URLSearchParams(location.hash.slice(1)).get('tune');
  if(token===null)return false;
  try{applySession(await decodeSession(token));message('Shared tune loaded. Press Play to listen; Save session keeps it here.');}
  catch{message('This tune link is invalid or uses an unsupported version. Your current tune was kept.');}
  return true;
}
window.addEventListener('hashchange',()=>restoreLink());
void (async()=>{if(!await restoreLink()&&await restoreSaved())message('Your saved tune is ready. Press Play to listen.');})();

$('.transpose-controls').onclick=e=>{
  const button=(e.target as HTMLElement).closest<HTMLElement>('[data-transpose]');if(!button)return;
  const stepOnly=$<HTMLSelectElement>('#transpose-target').value==='step';
  if(stepOnly&&(selected<0||$('#note-editor').hidden)){message('Select a note in the pattern first.');return;}
  if(stepOnly?pattern.notes[selected]===null:pattern.notes.every(n=>n===null)){message('There are no notes to transpose in that selection.');return;}
  const amount=Number(button.dataset.transpose);
  try{
    pattern.notes=transposeNotes(pattern.notes,amount,stepOnly?selected:undefined);render();
    message((stepOnly?'Selected note':'Current synth pattern')+' moved '+(amount>0?'up':'down')+' '+(Math.abs(amount)===12?'one octave.':'one semitone.'));
  }catch(error){message(error instanceof Error?error.message:'Could not transpose the notes.');}
};
