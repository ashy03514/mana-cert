'use strict';
const assert=require('node:assert/strict');
require('../js/dark-demon-wing-motion.js');
const M=globalThis.DarkDemonWingMotion;
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('Background pulse must not consume certification randomness');};
Date.now=()=>{throw Error('Background pulse must use the supplied animation clock');};
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,message+' '+a+' / '+b);
try{
 const initial=M.inwardPulse(0);
 assert.deepEqual(initial,{cycle:0,phase:0,front:1,alpha:0});
 for(const invalid of [undefined,null,'2',NaN,Infinity,-Infinity,-1]){
  assert.deepEqual(M.inwardPulse(invalid),initial,'invalid or negative time safely samples the beginning');
 }
 for(let cycle=0;cycle<5;cycle++){
  const start=cycle*2;
  assert.deepEqual(M.inwardPulse(start),{...initial,cycle},'a new invisible wave starts every two seconds');
  let prior=1;
  for(let frame=0;frame<=198;frame++){
   const phase=frame/120,s=M.inwardPulse(start+phase);
   assert.equal(s.cycle,cycle);
   close(s.phase,phase/2,'normalized phase follows only supplied active time');
   for(const key of ['front','alpha'])assert.ok(Number.isFinite(s[key])&&s[key]>=0&&s[key]<=1,key+' stays finite and bounded');
   assert.ok(s.front<=prior+1e-8,'wavefront always travels from outside toward the center');
   prior=s.front;
  }
  const nearCenter=M.inwardPulse(start+1.6);
  assert.ok(nearCenter.front<.1,'the wave reaches the core before fading');
  assert.ok(nearCenter.alpha>0,'the inward wave remains visible near the core');
  assert.ok(M.inwardPulse(start+.18).alpha>.9,'wave has emerged after the initial fade');
  for(const phase of [1.65,1.75,1.9,1.999999]){
   const s=M.inwardPulse(start+phase);
   close(s.front,0,'spent wave rests at the center');
   close(s.alpha,0,'the interval before the next wave is invisible');
  }
  for(const boundary of [.18,1.45,1.65,2]){
   const before=M.inwardPulse(start+boundary-1e-6),after=M.inwardPulse(start+boundary+1e-6);
   assert.ok(Math.abs(before.alpha-after.alpha)<.001,'opacity stays continuous at fade and cycle boundaries');
   if(boundary===2){
    assert.ok(before.alpha<.001&&after.alpha<.001,'resetting the wavefront at the edge cannot produce a visible jump');
   }else{
    assert.ok(Math.abs(before.front-after.front)<.001,'inward movement stays continuous');
   }
  }
 }
 for(const time of [.04,.77,1.6,2.6,9.2,10000.77]){
  const saved=M.inwardPulse(time);
  M.inwardPulse(time+141);M.inwardPulse(0);M.sample(83,'SS');
  assert.deepEqual(M.inwardPulse(time),saved,'pause, replay and out-of-order sampling preserve the same frame');
  const next=M.inwardPulse(time+2);
  close(next.front,saved.front,'successive waves share the same inward route');
  close(next.alpha,saved.alpha,'successive waves share the same fade');
 }
 console.log('PASS dark inward pulse: fixed two-second cadence, continuous outside-to-core travel and fades, invisible resets, bounded invalid input handling, supplied-clock replay without result RNG.');
}finally{Math.random=random;Date.now=now;}
