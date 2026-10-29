import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { encodeSession, decodeSession, readStoredSession, saveCookie, readCookie } from '../src/session.ts';

const patch = { voice:'fm',cutoff:2800,decay:.28,tone:40,resonance:2,volume:.7 };
const session = {
  bpm:137,swing:.31,root:6,activeTrack:1,masterVolume:.42,
  drums:[Array.from({length:16},(_,i)=>i%3===0),Array(16).fill(true)],
  drumKinds:[0,0],drumVolumes:[0,.83],muted:[false,true],
  tracks:[{notes:Array(16).fill(null),patch,volume:0,muted:true},
    {notes:Array.from({length:16},(_,i)=>i%2?null:36+i),patch:{...patch,voice:'modular'},volume:.67,muted:false}]
};
const token=await encodeSession(session);
assert.deepEqual(await decodeSession(token),session);
assert.deepEqual(await readStoredSession(token),session);
const link=new URL('https://jcnossen.nl/synth/');link.hash='tune='+token;
assert.deepEqual(await decodeSession(new URLSearchParams(link.hash.slice(1)).get('tune')),session);
assert.ok(token.length<3800);
const legacy={...session,pattern:{drums:session.drums,notes:session.tracks[1].notes},patch};
assert.deepEqual(await readStoredSession(JSON.stringify(legacy)),session);
const oldest={pattern:legacy.pattern,patch,bpm:112,swing:0,root:0};
assert.equal((await readStoredSession(JSON.stringify(oldest))).tracks[0].volume,1);
assert.equal((await readStoredSession(JSON.stringify(oldest))).masterVolume,.7);
for(const bad of ['','v3.abc','v2.abc','v1.bad!','v1.'+'a'.repeat(60001),'v1.'+btoa('{}')])await assert.rejects(()=>decodeSession(bad));
const raw=inflateSync(Buffer.from(token.slice(3),'base64url'));
const oldToken='v1.'+raw.toString('base64url');
assert.deepEqual(await decodeSession(oldToken),session);
assert.deepEqual(await readStoredSession(oldToken),session);
assert.ok(token.length<oldToken.length);
const packed=JSON.parse(raw);
packed[3]=999;
await assert.rejects(()=>decodeSession('v1.'+btoa(JSON.stringify(packed)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')));
await assert.rejects(()=>encodeSession({...session,tracks:[{...session.tracks[0],volume:-1}]}));
let cookie='',lastWrite='';
globalThis.location={protocol:'https:'};
globalThis.document={get cookie(){return cookie;},set cookie(value){lastWrite=value;cookie=value.includes('Max-Age=0')?'':value.split(';')[0];}};
assert.equal(saveCookie(token),true);assert.equal(readCookie(),token);
assert.ok(lastWrite.includes('Path=/synth/'));assert.ok(lastWrite.includes('SameSite=Lax'));assert.ok(lastWrite.includes('Secure'));
assert.equal(saveCookie('a'.repeat(3801)),false);assert.equal(readCookie(),null);
console.log(`Session tests passed: round trip (${token.length} characters), link, legacy migration, invalid data, and cookie limits.`);

await assert.rejects(()=>decodeSession('v2.'+deflateSync(Buffer.alloc(45001,32)).toString('base64url')),/size/);
await assert.rejects(()=>decodeSession(token.slice(0,-5)));
const compressedBytes=Buffer.from(token.slice(3),'base64url');compressedBytes[5]^=255;
await assert.rejects(()=>decodeSession('v2.'+compressedBytes.toString('base64url')));
const nativeCompression=globalThis.CompressionStream;
globalThis.CompressionStream=undefined;
assert.equal(await encodeSession(session),oldToken);
globalThis.CompressionStream=nativeCompression;
const large={...session,tracks:Array.from({length:16},(_,i)=>({...session.tracks[i%2],notes:Array.from({length:16},(_,j)=>j%3?36+(i+j)%24:null)}))};
const largeToken=await encodeSession(large);
const largeOld='v1.'+inflateSync(Buffer.from(largeToken.slice(3),'base64url')).toString('base64url');
assert.deepEqual(await decodeSession(largeToken),large);
console.log(`Two-track tune: ${oldToken.length} -> ${token.length} characters (${Math.round((1-token.length/oldToken.length)*100)}% shorter).`);
console.log(`16-track tune: ${largeOld.length} -> ${largeToken.length} characters (${Math.round((1-largeToken.length/largeOld.length)*100)}% shorter).`);
console.log('Compression compatibility, corruption, expansion limit, and older-browser fallback checks passed.');

for(const voice of ['slap','dx','finger','analog']) {
  const tune={...session,tracks:[{...session.tracks[0],patch:{...patch,voice}}],activeTrack:0};
  assert.deepEqual(await decodeSession(await encodeSession(tune)),tune);
}
console.log('All added sound engines survive save/share round trips.');
