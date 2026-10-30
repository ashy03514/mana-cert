'use strict';
const assert=require('node:assert/strict');
require('../js/dark-demon-wing-motion.js');
const M=globalThis.DarkDemonWingMotion;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
for(const t of [-1,NaN,Infinity,-Infinity]){
 assert.deepEqual(M.sample(t),M.sample(0));assert.deepEqual(M.point(.25,.8,t),M.point(.25,.8,0));assert.deepEqual(M.particles(t),M.particles(0));
}
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('Animation cannot consume certification randomness');};
Date.now=()=>{throw Error('Animation must use supplied active time');};
try{
 let minArea=Infinity;
 const times=[...Array.from({length:48},(_,i)=>i*.2),1.85,2.02,2.36,19,100,10000];
 for(const t of times){
  const s=M.sample(t);
  for(const field of ['charge','release','burst','visible'])assert.ok(s[field]>=0&&s[field]<=1);
  for(const side of [-1,1]){
   assert.deepEqual(M.point(.5,.43,t,side,s),{x:.5,y:.43},'wing root anchored');
   for(const f of [0,1])for(const [u,v] of [[.35,.177],[.21,.56],[.45,.415]])assert.deepEqual(M.chainPoint(u,v,t,side,f,s),M.point(u,v,t,side,s),'chain ends track the bone exactly');
  }
  for(const side of [-1,1]){
   const u0=side<0?-.03:.5,cols=30,rows=28,du=.53/cols,dv=1.06/rows;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const u=u0+x*du,v=-.03+y*dv;
    const a=M.point(u,v,t,side,s),b=M.point(u+du,v,t,side,s),c=M.point(u,v+dv,t,side,s),d=M.point(u+du,v+dv,t,side,s);
    for(const p of [a,b,c,d])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x-.5)<.7&&Math.abs(p.y-.43)<1,'finite bounded mesh');
    for(const ar of [area(a,b,c),area(c,b,d)]){minArea=Math.min(minArea,ar);assert.ok(ar>1e-5,'no triangle fold at '+t);}
   }
  }
 }
 const charging=M.sample(1.9),released=M.sample(2.6),idle=M.sample(5.2);
 assert.ok(charging.charge>.99&&charging.release===0&&charging.burst===0,'charge precedes release');
 assert.ok(released.release>.99&&released.burst>.7&&released.charge===0,'wing opens with the magical burst');
 assert.equal(idle.charge+idle.release+idle.burst,0);
 for(const u of [.18,.82]){
  const a=M.point(u,.90,1.9),b=M.point(u,.90,2.6);
  assert.ok(a.y>b.y+.05,'trailing tips lift from charge to release');
  assert.ok(Math.abs(a.x-.5)<Math.abs(b.x-.5),'release opens outward');
  const idleStart=M.point(u,.90,5.2),idleTravel=Math.max(...[6.2,7.2,8.2].map(t=>distance(idleStart,M.point(u,.90,t))));
  assert.ok(idleTravel>.04,'idle stroke remains visibly alive across its slow turning point');
 }
 assert.ok(distance(M.chainPoint(.30,.40,2.3,-1,.5),M.point(.30,.40,2.3,-1))>.01,'hanging chain lags at the release impulse');
 for(let t=0;t<30;t+=.025){
  const a=M.sample(t),b=M.sample(t+.00001);
  for(const k of ['charge','release','burst','visible','core','rays'])assert.ok(Math.abs(a[k]-b[k])<.001,'continuous '+k);
  const particles=M.particles(t);assert.ok(particles.length<=86,'bounded particle pool');
  for(const p of particles){
   for(const k of ['x','y','size','alpha','rotation'])assert.ok(Number.isFinite(p[k]),'finite particle '+k);
   assert.ok(p.alpha>=0&&p.alpha<=1&&p.size>0&&p.size<=.013,'bounded particle appearance');
  }
 }
 assert.equal(M.particles(1.9).filter(p=>p.star).length,0,'stars wait for release');
 assert.equal(M.particles(2.6).filter(p=>p.star).length,22,'burst contains stars');
 assert.equal(M.particles(5.2).filter(p=>p.star).length,0,'stars clear before idle');
 for(const cycle of [1,2,27,1000]){
  const before=cycle*M.PERIOD-.00001,after=cycle*M.PERIOD+.00001;
  for(const [u,v] of [[.18,.90],[.35,.17],[.5,.43],[.65,.17],[.82,.90]]){
   assert.ok(distance(M.point(u,v,before),M.point(u,v,after))<.0001,'pose does not reset at loop');
   assert.ok(distance(M.chainPoint(u,v,before,undefined,.5),M.chainPoint(u,v,after,undefined,.5))<.0001,'chain does not reset at loop');
  }
 }
 assert.deepEqual(M.point(NaN,NaN,0),{x:.5,y:.43});
 const benchStart=performance.now();let check=0;
 for(let frame=0;frame<120;frame++){
  const t=frame/30,s=M.sample(t);
  for(let i=0;i<1800;i++)check+=M.point((i%60)/59,Math.floor(i/60)/29,t,undefined,s).x;
 }
 assert.ok(Number.isFinite(check)&&performance.now()-benchStart<5000,'120 frame mesh math has no unexpected CPU cost');
 console.log('PASS SS demon articulation, continuous loops and idle, fixed roots/chain endpoints, burst chronology, particle bounds, replay, no folded mesh. Minimum signed area:',minArea);
}finally{Math.random=random;Date.now=now;}
