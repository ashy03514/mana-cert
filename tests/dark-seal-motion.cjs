'use strict';
const assert=require('node:assert/strict');require('../js/dark-seal-motion.js');const M=DarkSealMotion;
for(const t of [-1,NaN,Infinity])assert.deepEqual(M.sample(t),M.sample(0));
const random=Math.random;Math.random=()=>{throw Error('Do not consume certification randomness');};
try{
 for(let t=0;t<20;t+=.025){
  const s=M.sample(t);for(const key of ['charge','surge','impact','reveal'])assert.ok(s[key]>=0&&s[key]<=1);
  for(let k=0;k<M.CHAINS.length;k++){
   assert.deepEqual(M.chainPoint(k,0,s),M.anchor(M.CHAINS[k].angle,s));
   const end=M.chainPoint(k,1,s);assert.ok(Math.hypot(end.x-Math.cos(M.CHAINS[k].end)*2.8,end.y-Math.sin(M.CHAINS[k].end)*2.8)<1e-12);
   for(let u=0;u<=1;u+=.1){const p=M.chainPoint(k,u,s),q=M.chainPoint(k,u,M.sample(t+.00001));assert.ok(Number.isFinite(p.x+p.y));assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<.0001,'chain has no positional steps');}
  }
 }
 assert.ok(M.sample(1.8).charge>.99);assert.ok(M.sample(2.7).surge>.99);assert.ok(M.sample(3.25).impact>.3);
 for(const t of [6.6,13.2,66]){const a=M.sample(t-1e-6),b=M.sample(t+1e-6);for(const key of ['charge','surge','impact','recoil','reveal'])assert.ok(Math.abs(a[key]-b[key])<1e-5);}
 const fixed=M.chainPoint(2,.5,M.sample(2.7));M.sample(500);assert.deepEqual(M.chainPoint(2,.5,M.sample(2.7)),fixed);
 assert.ok(Math.hypot(fixed.x-M.chainPoint(2,.5,M.sample(1.8)).x,fixed.y-M.chainPoint(2,.5,M.sample(1.8)).y)>.05);
 for(const [w,h] of [[320,568],[390,844],[844,390]])assert.ok(M.layout(w,h).radius>0);
 console.log('PASS dark SS motion: deterministic pressure phases, continuous restraint paths, fixed outer attachments, bounded values, invalid clocks and cycle continuity.');
}finally{Math.random=random;}
