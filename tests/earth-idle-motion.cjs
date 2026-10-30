'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/earth-rank-effects.js');
require('../js/earth-mountain-renderer.js');
const E=EarthMountainRenderer,FX=EarthRankEffects,r=Object.create(E.prototype);
const vector=p=>[p.x,p.y,p.z];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const close=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
const random=Math.random;
Math.random=()=>{throw Error('idle motion must not consume certification randomness');};
try{
  r.formation=1;
  for(const profile of FX.profiles){
    r.profile=profile;
    const catalog=E.stonesForRank(profile.rank);
    for(const spec of catalog){
      const delay=(spec.seed%4)*.065,contact=4.18+delay;
      for(const time of [0,1.7,10,123.4]){
        for(const actionTime of [contact-.08,contact,contact+.10]){
          const f=r.stoneFloat(spec,time,actionTime);
          assert.equal(f.amount,0,profile.rank+' makes firm contact before floating resumes');
          assert.ok([...vector(f),f.tilt,f.twist].every(v=>v===0));
        }
      }
      const motions=Array.from({length:65},(_,i)=>r.stoneFloat(spec,i*.125,5.6+delay));
      for(const key of ['x','y','z'])assert.ok(Math.max(...motions.map(f=>f[key]))-Math.min(...motions.map(f=>f[key]))>.008,
        profile.rank+' each stone has visible independent '+key+' motion after compression');
      for(const f of motions){
        assert.ok(distance(vector(f),[0,0,0])<.10,'floating remains small compared to the rock structure');
        assert.ok(Math.abs(f.tilt)<=.009+1e-12&&Math.abs(f.twist)<=.007+1e-12,'tilt stays below one degree');
        assert.equal(f.amount,1,'normal post-contact phase restores floating completely');
      }
      const replay=r.stoneFloat(spec,2.17,5.6+delay);
      r.stoneFloat(spec,1000,1000);
      assert.deepEqual(r.stoneFloat(spec,2.17,5.6+delay),replay,'rewind and pause retain identical positions');
      // A cycle boundary cannot introduce a positional or velocity jump.
      const epsilon=1e-5,boundary=6.8+delay;
      const at=t=>r.stoneFloat(spec,10+t-boundary,t);
      const before=at(boundary-epsilon),middle=at(boundary),after=at(boundary+epsilon);
      for(const key of ['x','y','z','tilt','twist']){
        close(before[key],after[key],1e-5);
        close((middle[key]-before[key])/epsilon,(after[key]-middle[key])/epsilon,1e-5);
      }
      const model=r.model(spec,3.7,5.6+delay);
      for(const offset of [0,4,8])close(Math.hypot(model[offset],model[offset+1],model[offset+2]),1);
      for(const [a,b] of [[0,4],[0,8],[4,8]])close(model[a]*model[b]+model[a+1]*model[b+1]+model[a+2]*model[b+2],0);
    }
    // A shared bob would leave all pairwise relative translations constant.
    for(let i=0;i<catalog.length;i++)for(let j=i+1;j<catalog.length;j++){
      const relative=time=>{
        const a=vector(r.stoneFloat(catalog[i],time,5.8)),b=vector(r.stoneFloat(catalog[j],time,5.8));
        return a.map((v,k)=>v-b[k]);
      };
      assert.ok(distance(relative(.3),relative(2.7))>.001,profile.rank+' adjacent stones do not float in lockstep');
    }
  }
  // Spatial phases must be continuous as the real rank morph changes each
  // stone's position/dimensions/seed, rather than hashing a new random phase.
  r.meshes=[];r.profile=FX.forRank('E');r.meshMode='preset';
  r.gl={createBuffer:()=>({}),deleteBuffer(){},bindBuffer(){},bufferData(){},ARRAY_BUFFER:1,DYNAMIC_DRAW:2};
  const result=Object.freeze({mana:9999,rank:'SS',element:'土',type:'magic'}),saved=JSON.stringify(result);
  for(const t of [1.2,1.35,1.55,1.75,1.95,2.15]){
    const frames=[];
    for(const time of [t,t+1e-6]){
      const f=FX.sample(time,result,.8);r.growingMeshes(f);
      frames.push(r.meshes.map(m=>m.count?r.stoneFloat(m.spec,f.time,f.actionTime):null));
    }
    for(let i=0;i<frames[0].length;i++){
      if(!frames[0][i]||!frames[1][i])continue;
      assert.ok(distance(vector(frames[0][i]),vector(frames[1][i]))<1e-4,'rank morph keeps local floating continuous');
    }
  }
  assert.equal(JSON.stringify(result),saved,'sampling never changes the chosen result');
}finally{Math.random=random;}
console.log('Earth idle motion passed: E–SS individual movement, firm contact, smooth cycle wrap, bounded rigid motion, deterministic pause/rewind and continuous morph phases.');
