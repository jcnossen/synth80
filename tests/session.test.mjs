import assert from 'node:assert/strict';
import { encodeSession, decodeSession, readStoredSession, saveCookie, readCookie } from '../src/session.ts';

const patch = { voice:'fm',cutoff:2800,decay:.28,tone:40,resonance:2,volume:.7 };
const session = {
  bpm:137,swing:.31,root:6,activeTrack:1,masterVolume:.42,
  drums:[Array.from({length:16},(_,i)=>i%3===0),Array(16).fill(true)],
  drumKinds:[0,0],drumVolumes:[0,.83],muted:[false,true],
  tracks:[{notes:Array(16).fill(null),patch,volume:0,muted:true},
    {notes:Array.from({length:16},(_,i)=>i%2?null:36+i),patch:{...patch,voice:'modular'},volume:.67,muted:false}]
};
const token=encodeSession(session);
assert.deepEqual(decodeSession(token),session);
assert.deepEqual(readStoredSession(token),session);
const link=new URL('https://jcnossen.nl/synth/');link.hash='tune='+token;
assert.deepEqual(decodeSession(new URLSearchParams(link.hash.slice(1)).get('tune')),session);
assert.ok(token.length<3800);
const legacy={...session,pattern:{drums:session.drums,notes:session.tracks[1].notes},patch};
assert.deepEqual(readStoredSession(JSON.stringify(legacy)),session);
const oldest={pattern:legacy.pattern,patch,bpm:112,swing:0,root:0};
assert.equal(readStoredSession(JSON.stringify(oldest)).tracks[0].volume,1);
assert.equal(readStoredSession(JSON.stringify(oldest)).masterVolume,.7);
for(const bad of ['','v2.abc','v1.bad!','v1.'+'a'.repeat(60001),'v1.'+btoa('{}')])assert.throws(()=>decodeSession(bad));
const packed=JSON.parse(atob(token.slice(3).replaceAll('-','+').replaceAll('_','/')));
packed[3]=999;
assert.throws(()=>decodeSession('v1.'+btoa(JSON.stringify(packed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')));
assert.throws(()=>encodeSession({...session,tracks:[{...session.tracks[0],volume:-1}]}));
let cookie='',lastWrite='';
globalThis.location={protocol:'https:'};
globalThis.document={get cookie(){return cookie;},set cookie(value){lastWrite=value;cookie=value.includes('Max-Age=0')?'':value.split(';')[0];}};
assert.equal(saveCookie(token),true);assert.equal(readCookie(),token);
assert.ok(lastWrite.includes('Path=/synth/'));assert.ok(lastWrite.includes('SameSite=Lax'));assert.ok(lastWrite.includes('Secure'));
assert.equal(saveCookie('a'.repeat(3801)),false);assert.equal(readCookie(),null);
console.log(`Session tests passed: round trip (${token.length} characters), link, legacy migration, invalid data, and cookie limits.`);
