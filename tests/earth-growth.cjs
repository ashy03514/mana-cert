'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');require('../js/earth-rank-effects.js');require('../js/earth-mountain-renderer.js');
const FX=EarthRankEffects,E=EarthMountainRenderer;
const complete=FireScanTransition.timing.complete,timing=FX.actionTiming;
const close=(actual,expected,tolerance=1e-10,message='values agree')=>
  assert.ok(Math.abs(actual-expected)<tolerance,`${message}: ${actual} vs ${expected}`);
assert.deepEqual(timing,{startPhase:2.95,accelerationDuration:.2,boostSpeed:1.8,decelerationPhase:4.6,decelerationDuration:.32});
assert.ok(Object.isFrozen(timing));assert.equal(complete,4.05);
const firstContact=FX.actionElapsedForTime(4.18,1);
const decelerationStart=FX.actionElapsedForTime(4.6,1);
const settledAt=decelerationStart+timing.decelerationDuration;
close(firstContact,.7833333333333333,1e-12,'the existing outward pose leads into a prompt first impact');
close(decelerationStart,1.0166666666666666,1e-12);
close(settledAt,1.3366666666666667,1e-12);
assert.ok(firstContact>.72,'first contact must follow the last possible rank morph');
for(const [mana,rank] of [[199,'E'],[349,'D'],[549,'C'],[749,'B'],[899,'A'],[999,'S'],[1000,'SS'],[9999,'SS']]){
  const result=Object.freeze({mana,rank,element:'土',type:'magic'}),copy=JSON.stringify(result);
  let previous=FX.sample(0,result,.8),previousWeights=previous.weights;
  assert.equal(previous.time,.8*.32,'formation retains its existing ambient clock offset');
  for(let i=1;i<=1200;i++){
    const t=i*.005,f=FX.sample(t,result,.8);
    assert.ok(f.weights.every(w=>w>=-1e-12&&w<=1));assert.ok(Math.abs(f.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
    assert.ok(f.level>=previous.level-1e-12,'structure grows monotonically');
    assert.ok(f.time>previous.time,'visual clock never rewinds');
    assert.ok(f.actionTime>=previous.actionTime,'absolute action clock never rewinds');
    if(t<=FireScanTransition.timing.scanStart)assert.equal(E.sample(f.actionTime).opening,0,'pre-count charge does not open the stones');
    else if(t<=complete){
      assert.ok(E.sample(f.actionTime).opening>=E.sample(previous.actionTime).opening,'stones separate progressively while the value grows');
      assert.ok(f.actionTime<=timing.startPhase,'growth preserves the final small outward anticipation');
    }
    const speed=(f.time-previous.time)/.005;
    assert.ok(Math.abs(speed-(f.profile.speed+previous.profile.speed)/2)<1e-4,'clock integrates actual changing speed');
    assert.ok(f.weights.every((w,j)=>Math.abs(w-previousWeights[j])<.02),'geometry weights remain continuous');
    assert.equal(f.value,FireScanTransition.sample(t,result).value,'growth follows the visible counter');
    if(f.value<900)assert.equal(f.profile.starScale,0);
    previous=f;previousWeights=f.weights;
  }
  assert.equal(previous.profile.rank,rank);assert.equal(previous.value,mana);
  for(const key of ['speed','opening','impact','mineral','dustCount','chipsCount','starScale','extent'])
    assert.ok(Math.abs(previous.profile[key]-FX.forRank(rank)[key])<1e-10,rank+' reaches the accepted '+key);
  assert.equal(JSON.stringify(result),copy);assert.equal(previous.weights[FX.profiles.findIndex(p=>p.rank===rank)],1);
  assert.deepEqual(FX.sample(2,result,.8),FX.sample(2,result,.8),'absolute time sampling is repeatable');
  const speed=FX.forRank(rank).speed,confirmed=FX.sample(complete,result,.8);
  assert.equal(confirmed.actionTime,timing.startPhase);assert.equal(confirmed.actionSpeed,speed);
  assert.ok(E.sample(confirmed.actionTime).opening>.75&&E.sample(confirmed.actionTime).opening<.85,
    'confirmation starts with separated stones rather than a closed mountain');
  const earlyGrowth=FX.sample(FireScanTransition.timing.scanStart+FireScanTransition.timing.scanDuration*.25,result,.8);
  assert.ok(E.sample(earlyGrowth.actionTime).opening>.2,'clear gaps begin during the first quarter of numeric growth');
  const midGrowth=FX.sample(FireScanTransition.timing.scanStart+FireScanTransition.timing.scanDuration*.5,result,.8);
  assert.ok(E.sample(midGrowth.actionTime).opening>.15&&E.sample(midGrowth.actionTime).opening<E.sample(confirmed.actionTime).opening,
    'the outward motion is visible during the numeric climb');
  const charging=FX.sample(complete+.01,result,.8);
  assert.ok(charging.actionTime>timing.startPhase,'the existing separated pose continues immediately after confirmation');
  assert.ok(E.sample(charging.actionTime).charge>0,'the immediate action phase visibly drives charge');
  const outward=FX.sample(complete+.4,result,.8),compressing=FX.sample(complete+firstContact-.05,result,.8);
  assert.ok(E.sample(outward.actionTime).opening>E.sample(confirmed.actionTime).opening,'confirmation adds a small outward push');
  assert.ok(E.sample(outward.actionTime).opening>.99,'anticipation reaches the existing maximum opening');
  assert.ok(E.sample(compressing.actionTime).opening<E.sample(outward.actionTime).opening,'the outward push leads directly into compression');
  close(FX.sample(complete+firstContact,result,.8).actionTime,4.18,1e-12,'first contact timing is identical across ranks');
  close(confirmed.actionOrigin,FX.sample(complete+.72,result,.8).time-speed*.72);
  // The contact happens after every rank blend. The final-speed extrapolation
  // must reconstruct its original ambient rotation exactly, including later cycles.
  for(const contact of [4.18,4.245,4.31,4.375,10.98,17.78]){
    const postAge=FX.actionElapsedForTime(contact,speed),frame=FX.sample(complete+postAge,result,.8);
    assert.ok(postAge>.72);close(frame.actionTime,contact,1e-10);
    close(confirmed.actionOrigin+postAge*speed,frame.time,1e-10,'collision uses the matching ambient contact time');
  }
  let priorAction=-1;
  for(const age of [0,.0001,.01,.05,.1,.2,.4,1,firstContact,decelerationStart,1.8,settledAt,3,8,40].sort((a,b)=>a-b)){
    const phase=FX.actionTimeForElapsed(age,speed);
    assert.ok(phase>priorAction,'action time stays globally increasing across cycles');priorAction=phase;
    close(FX.actionElapsedForTime(phase,speed),age,1e-8,'forward and inverse action clocks round trip');
    close(FX.sample(complete+age,result,.8).actionTime,phase,1e-12);
  }
  const epsilon=1e-5,rateAt=t=>(FX.actionTimeForElapsed(t+epsilon,speed)-FX.actionTimeForElapsed(t-epsilon,speed))/(2*epsilon);
  close(rateAt(0),0,1e-7,'motion starts at rest');
  const phaseRate=t=>(FX.sample(t+epsilon,result,.8).actionTime-FX.sample(t-epsilon,result,.8).actionTime)/(2*epsilon);
  close(phaseRate(complete-epsilon),phaseRate(complete+epsilon),.0002,'growth and result action clocks join without a velocity snap');
  // Opening is eased inside the renderer, so its actual visible velocity is
  // the invariant at scan start even when the advancing phase begins faster.
  for(const delay of [0,.065,.13,.195]){
    const openingAt=t=>E.sample(Math.max(0,FX.sample(t,result,.8).actionTime-delay)).opening;
    const openingRate=t=>(openingAt(t+epsilon)-openingAt(t-epsilon))/(2*epsilon);
    for(const boundary of [FireScanTransition.timing.scanStart,complete])
      close(openingRate(boundary-epsilon),openingRate(boundary+epsilon),.0002,'each delayed rock begins opening and confirms without a visible velocity snap');
  }
  for(const boundary of [timing.accelerationDuration,decelerationStart,settledAt]){
    close(rateAt(boundary-epsilon),rateAt(boundary+epsilon),1e-6,'action speed is continuous at each join');
  }
  close(rateAt(.1),.9,1e-7,'initial speed follows the smooth acceleration curve');
  close(rateAt(.2),1.8,1e-7);close(rateAt(1),1.8,1e-7);
  close(rateAt(decelerationStart+.16),(1.8+speed)/2,1e-7);
  close(rateAt(settledAt),speed,1e-7);close(rateAt(20),speed,1e-8,'subsequent cycles keep the final rank speed');
  assert.equal(JSON.stringify(result),copy,'additional clock sampling never changes the committed result');
}
for(const t of [-1,NaN,Infinity])assert.deepEqual(FX.sample(t,{mana:9999},.8),FX.sample(0,{mana:9999},.8));
for(const invalid of [-1,NaN,Infinity]){
  assert.equal(FX.actionTimeForElapsed(invalid),timing.startPhase);assert.equal(FX.actionElapsedForTime(invalid),0);
}
for(const invalid of [0,-1,NaN,Infinity]){
  assert.equal(FX.actionTimeForElapsed(5,invalid),FX.actionTimeForElapsed(5,1));
  assert.equal(FX.actionElapsedForTime(8,invalid),FX.actionElapsedForTime(8,1));
}
// Exercise real mesh construction without requiring a GPU. Pure snapshot
// transitions must converge to exact preview vertices, not approximate shapes.
const renderer=Object.create(E.prototype);renderer.meshes=[];renderer.profile=FX.forRank('E');renderer.meshMode='preset';
renderer.gl={createBuffer:()=>({}),deleteBuffer(){},bindBuffer(){},bufferData(){},ARRAY_BUFFER:1,DYNAMIC_DRAW:2};
for(let r=0;r<7;r++){
  const weights=Array.from({length:7},(_,i)=>i===r?1:0);renderer.growingMeshes({weights});
  const expected=E.stonesForRank(FX.profiles[r].rank);
  const actual=renderer.meshes.filter(m=>m.count);
  assert.equal(actual.length,expected.length);
  for(const spec of expected){const mesh=actual.find(m=>m.spec.seed===spec.seed);assert.ok(mesh);assert.deepEqual(mesh.data,E.geometry(spec));}
}
const result={mana:9999,element:'土'},t=1.6;
renderer.growingMeshes(FX.sample(t,result,.8));const before=renderer.meshes.map(m=>m.data&&new Float32Array(m.data));
renderer.growingMeshes(FX.sample(t+1e-5,result,.8));
let delta=0;renderer.meshes.forEach((m,j)=>{if(m.count&&before[j])for(let i=0;i<m.data.length;i+=6)for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(m.data[i+k]-before[j][i+k]));});
assert.ok(delta>0&&delta<.001,'growing triangles change continuously between adjacent samples');
// Separating low-grade stones must be real rigid displacement, not a scaled
// miniature mountain. Keep the ambient clock fixed to isolate the action.
renderer.formation=1;renderer.morphing=false;
const centerOf=matrix=>matrix.slice(12,15);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(const rank of ['E','D']){
  renderer.profile=FX.forRank(rank);const catalog=E.stonesForRank(rank);
  let lastDistances=null,firstDistances=null;
  for(const phase of [1.6,2.2,2.65,2.95,3.70]){
    const models=catalog.map(spec=>renderer.model(spec,2,phase)),centers=models.map(centerOf),distances=[];
    for(const m of models)for(const axis of [0,4,8])close(Math.hypot(m[axis],m[axis+1],m[axis+2]),1,1e-12,rank+' keeps the individual rock size');
    for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++)distances.push(distance(centers[i],centers[j]));
    if(lastDistances)assert.ok(distances.every((value,i)=>value>lastDistances[i]),rank+' stones progressively move apart from each other');
    else firstDistances=distances;
    lastDistances=distances;
  }
  assert.ok(lastDistances.some((v,i)=>v>firstDistances[i]+.05),rank+' separation is substantial enough to be visible');
  const compressed=catalog.map(spec=>centerOf(renderer.model(spec,2,4.95)));let index=0;
  for(let i=0;i<compressed.length;i++)for(let j=i+1;j<compressed.length;j++)
    assert.ok(distance(compressed[i],compressed[j])<lastDistances[index++]*.9,rank+' stones compress into their assembled structure');
}
// Split action timing must not reset the ambient pose when any result settles.
for(const [mana,rank] of [[199,'E'],[349,'D'],[549,'C'],[749,'B'],[899,'A'],[999,'S'],[9999,'SS']]){
  renderer.profile=FX.forRank(rank);
  const current={mana,rank,element:'土'},before=FX.sample(complete-1e-5,current,.8),after=FX.sample(complete+1e-5,current,.8);
  for(const spec of E.stonesForRank(rank)){
    const first=renderer.model(spec,before.time,before.actionTime),second=renderer.model(spec,after.time,after.actionTime);
    assert.ok(first.every((value,i)=>Math.abs(value-second[i])<1e-5),rank+' completion preserves the rock pose');
  }
}
renderer.profile=FX.forRank('SS');
const contactFrame=FX.sample(complete+firstContact,result,.8);
renderer.actionOrigin=contactFrame.actionOrigin;renderer.actionSpeed=contactFrame.actionSpeed;
const particleFrame=phase=>{
  const frame=FX.sample(complete+FX.actionElapsedForTime(phase,1),result,.8);
  return renderer.collisionParticles(frame.time,frame.actionTime);
};
const earlier=particleFrame(4.42),later=particleFrame(4.45);
assert.ok(earlier.length&&later.length,'the first impact emits collision particles');
let matched=0;
for(const first of earlier){
  const second=later.find(p=>p.type===first.type&&p.contact===first.contact&&p.life===first.life&&p.size===first.size);
  if(!second)continue;
  assert.deepEqual(second.source,first.source,'a collision particle keeps its birth position across frames');
  assert.notDeepEqual(second.position,first.position,'existing particles keep moving from that fixed source');matched++;
}
assert.ok(matched>20,'verify source continuity across many persistent collision particles');
console.log('Earth growth passed: immutable results, progressive separation, rigid E/D motion, continuous confirmation push/compression, prompt contact, reversible timing, fixed collision sources and exact endpoint meshes.');
