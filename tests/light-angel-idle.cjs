'use strict';
const assert=require('node:assert/strict');
require('../js/light-angel-motion.js');
require('../js/fire-scan-transition.js');
require('../js/light-rank-growth.js');
const M=LightAngelMotion;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const range=values=>Math.max(...values)-Math.min(...values);
// Probe visible flight feathers in each distinct rank drawing, rather than
// empty UV padding that can move while the smaller A artwork stays still.
const probes={A:[.78,.35],S:[.88,.23],SS:[.92,.14]};
const savedRandom=Math.random,savedNow=Date.now;
Math.random=()=>{throw Error('Idle motion must not consume result randomness');};
Date.now=()=>{throw Error('Idle motion must use the supplied active clock');};
try{
  for(const rank of ['A','S','SS']){
    const [u,v]=probes[rank];
    for(const cycle of [0,1,17,1000]){
      const ys=[],angles=[],jointAngles=[];
      for(let offset=4.2;offset<=9.1;offset+=.05){
        const time=cycle*M.PERIOD+offset,s=M.sample(time,rank);
        assert.equal(s.charge+s.expansion+s.burst,0,'probe only ordinary idle, not ceremonial release');
        assert.equal(s.scale,1,'idle movement does not depend on whole-image zoom');
        const p=M.point(u,v,time,1,rank),shoulder=M.point(.60,.59,time,1,rank);
        ys.push(p.y);angles.push(Math.atan2(p.y,p.x));
        jointAngles.push(Math.atan2(p.y,p.x)-Math.atan2(shoulder.y,shoulder.x));
        assert.ok(distance(p,M.point(u,v,time+1/60,1,rank))<.002,
          rank+' idle moves slowly between frames');
        for(const side of [-1,1]){
          const root=M.point(.5,.72,time,side,rank);
          assert.ok(Math.hypot(root.x,root.y)<1e-12,'joined roots remain anchored');
        }
      }
      assert.ok(range(ys)>.025,rank+' visible tips move by more than 2.5% of the art width during idle');
      assert.ok(range(angles)>.06,rank+' wing articulation changes its angle, not only its size');
      assert.ok(range(jointAngles)>.02,rank+' wrist follows the shoulder with separate flex');
    }

    for(const time of [0,1.72,2.01,2.38,4.2,5.2,6.2,8.7,9.2,12,27,60,120,10000]){
      assert.deepEqual(M.point(u,v,time,1,rank),M.point(u,v,time,1,rank),'paused samples reproduce the exact pose');
      assert.ok(distance(M.point(u,v,time,1,rank),M.point(u,v,time+.00001,1,rank))<.0001,
        'idle and release pose stays continuous');
      for(const [u0,u1,side] of [[-.065,.5,-1],[.5,1.065,1]]){
        const cols=24,rows=24,du=(u1-u0)/cols,dv=1.16/rows;
        for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
          const a=M.point(u0+x*du,-.08+y*dv,time,side,rank);
          const b=M.point(u0+(x+1)*du,-.08+y*dv,time,side,rank);
          const c=M.point(u0+x*du,-.08+(y+1)*dv,time,side,rank);
          const d=M.point(u0+(x+1)*du,-.08+(y+1)*dv,time,side,rank);
          for(const p of [a,b,c,d])assert.ok(Number.isFinite(p.x+p.y)&&Math.abs(p.x)<.70&&Math.abs(p.y)<.75,'mesh remains finite and inside the render margin');
          assert.ok(area(a,b,c)>1e-6&&area(c,b,d)>1e-6,rank+' mesh never folds or inverts');
        }
      }
    }
    for(const cycle of [1,2,17,1000]){
      const boundary=cycle*M.PERIOD;
      assert.ok(distance(M.point(u,v,boundary-.00001,1,rank),M.point(u,v,boundary+.00001,1,rank))<.0001,
        'ceremonial cycle never resets the ongoing idle phase');
    }

    const result=Object.freeze({element:'光',rank,mana:{A:800,S:950,SS:9999}[rank]});
    const before=LightRankGrowth.sample(20,result),after=LightRankGrowth.sample(21,result);
    assert.ok(before.complete&&after.complete,'formal result has settled');
    assert.ok(after.time>before.time,'formal idle clock keeps advancing after rank confirmation');
    assert.equal(before.rank,rank);assert.equal(after.rank,rank);
    assert.ok(distance(M.point(u,v,before.time,1,rank),M.point(u,v,after.time,1,rank))>.001,
      'settled formal wings continue moving');
  }
}finally{Math.random=savedRandom;Date.now=savedNow;}
console.log('PASS A/S/SS idle: visible slow tip travel, fixed roots, wrist follow-through, no zoom/folds, continuous deterministic clocks, movement after formal confirmation.');
