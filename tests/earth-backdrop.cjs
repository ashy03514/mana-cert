'use strict';
// CPU timing, protection and actual Canvas fallback. WebGL appearance is
// covered separately; these checks never launch a browser or allocate a GPU.
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/earth-rank-effects.js');
require('../js/earth-backdrop.js');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
const profile=rank=>EarthRankEffects.forRank(rank);
const create=()=>new EarthBackdrop(()=>createCanvas(1,1));
const backdrop=create(),start=EarthBackdrop.sample(0);

for(const time of [0,.1,.5,1,1.5,1.8,1.99,20.25,100.5]){
  const a=EarthBackdrop.periodic(time),b=EarthBackdrop.periodic(time+2);
  assert.equal(b.cycle,a.cycle+1);
  for(const key of ['age','radius','width','opacity'])close(a[key],b[key],'quiet pulse repeats every two active seconds');
  assert.ok(a.opacity>=0&&a.opacity<=.12,'regular pulse remains faint');
}
assert.equal(EarthBackdrop.periodic(1.8).opacity,0);
assert.equal(EarthBackdrop.periodic(2).opacity,0,'period wrap has no sudden flash');
for(const invalid of [-1,NaN,Infinity])assert.deepEqual(EarthBackdrop.periodic(invalid),EarthBackdrop.periodic(0));

for(const time of [-1,NaN,Infinity,-Infinity])
  assert.deepEqual(EarthBackdrop.sample(time),start,'invalid or negative time starts at zero');
for(const time of [0,.3,1.6,3.5,3.9,4.179,4.18,4.22,4.43,5.8,6.53,6.79,682.4]){
  const a=EarthBackdrop.sample(time),b=EarthBackdrop.sample(time+6.8);
  for(const [key,value] of Object.entries(a))assert.ok(Number.isFinite(value),key+' remains finite');
  assert.equal(b.cycle,a.cycle+1,'one pulse follows each 6.8-second rock cycle');
  for(const key of ['phase','age','inward','strength','echo','burst','radius'])close(a[key],b[key],key+' repeats with the rock cycle');
  for(const key of ['inward','strength','echo','burst'])assert.ok(a[key]>=0&&a[key]<=1,key+' stays bounded');
  EarthBackdrop.sample(time+100);
  assert.deepEqual(EarthBackdrop.sample(time),a,'pause/rewind does not depend on intervening samples');
}
for(const time of [0,1.3,3.6,4,4.179,4.18])assert.equal(EarthBackdrop.sample(time).burst,0,'no burst before rock contact');
close(EarthBackdrop.sample(4.18).age,0,'burst origin matches the 4.18-second contact');
assert.ok(EarthBackdrop.sample(4.25).burst>0,'energy expands after contact');
assert.equal(EarthBackdrop.sample(6.53).burst,0,'main pressure wave fades by 6.53 seconds');
assert.ok(EarthBackdrop.sample(3.5).inward>EarthBackdrop.sample(1.3).inward,'energy gathers through the opening phase');
assert.equal(EarthBackdrop.sample(4.18).inward,0,'inward pressure releases at impact');

let previous=-1;
for(const rank of ['E','D','C','B','A','S','SS']){
  const m=EarthBackdrop.sample(4.43,profile(rank));
  if(rank==='E'||rank==='D')assert.equal(m.strength,0,rank+' has breathing light without an impact blast');
  else assert.ok(m.strength>previous,rank+' increases the same pressure-wave strength');
  if(rank==='S'||rank==='SS')assert.ok(m.echo>0&&m.echo<=1,rank+' has a weaker trailing wake');
  else assert.equal(m.echo,0,rank+' has no trailing wake');
  previous=m.strength;
}
for(let impact=.1;impact<1;impact+=.025){
  const a=EarthBackdrop.sample(4.43,{impact,starScale:0});
  const b=EarthBackdrop.sample(4.43,{impact:impact+1e-6,starScale:0});
  assert.ok(b.strength>=a.strength&&b.strength-a.strength<.001,'rank strength changes continuously');
}

const box={x:8,y:42,width:374,height:374},readout={x:95,y:540,width:200,height:170};
const regions=backdrop.regions(390,844,box,readout),inputs=JSON.stringify({box,readout});
assert.deepEqual(regions.readout,readout,'formal readout protection uses the supplied rectangle');
assert.equal(JSON.stringify({box,readout}),inputs,'region sampling does not mutate host geometry');
close(regions.origin.x,195,'pulse is horizontally centred under the mountain');
for(const rect of [regions.focus,regions.readout]){
  close(backdrop.shelter(rect.x+rect.width/2,rect.y+rect.height/2,rect),1,'region centre has full protection');
  close(backdrop.shelter(rect.x+rect.width*3,rect.y+rect.height*3,rect),0,'distant atmosphere remains visible');
  assert.ok(backdrop.shelter(rect.x+rect.width,rect.y+rect.height/2,rect)>0,'protection feathers around the region');
}
for(const invalid of [undefined,{x:NaN,y:0,width:10,height:10},{x:0,y:0,width:0,height:10}]){
  const fallback=backdrop.regions(390,844,invalid,invalid);
  for(const rect of [fallback.focus,fallback.readout])for(const value of Object.values(rect))assert.ok(Number.isFinite(value)&&value>0,'missing or invalid region gets usable protection');
}

function paint(time,{owner=backdrop,width=390,height=844,rank='SS',hostTime=time,formation=1}={}){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.globalAlpha=.63;ctx.globalCompositeOperation='screen';ctx.translate(1,2);
  const transform=ctx.getTransform(),alpha=ctx.globalAlpha;
  const options={time,hostTime,profile:profile(rank),box,readout,formation},before=JSON.stringify(options);
  const drawn=owner.draw(ctx,width,height,options);
  assert.equal(ctx.globalAlpha,alpha,'caller opacity is preserved');
  assert.equal(ctx.globalCompositeOperation,'screen','caller blend is preserved');
  assert.deepEqual(ctx.getTransform(),transform,'caller transform is preserved');
  assert.equal(JSON.stringify(options),before,'drawing leaves host options unchanged');
  return {drawn,pixels:Buffer.from(ctx.getImageData(0,0,width,height).data)};
}
const first=paint(4.43),count=backdrop.drawCount;
assert.ok(first.drawn&&first.pixels.some(value=>value>0),'CPU fallback paints visible energy without WebGL');
assert.ok(backdrop.failed,'test uses Canvas fallback rather than a GPU');
assert.ok(first.pixels.equals(paint(4.43).pixels),'paused energy remains pixel-identical');
assert.equal(backdrop.drawCount,count,'paused frames retain the cached energy image');
paint(4.44);assert.equal(backdrop.drawCount,count,'sub-30fps time step retains the cached image');
paint(4.47);assert.equal(backdrop.drawCount,count+1,'next 30fps step redraws');
assert.ok(first.pixels.equals(paint(4.43).pixels),'rewinding reconstructs the same image');
assert.ok(!first.pixels.equals(paint(5.1).pixels),'energy continues moving with the host clock');
assert.ok(!paint(4.43,{formation:0}).pixels.some(value=>value>0),'invisible formation paints no energy');
for(const [width,height] of [[320,568],[844,390]])assert.equal(paint(4.43,{width,height}).drawn,true,'fallback handles portrait and landscape');

// An unavailable GPU must not turn weak E/D breathing into a full blast.
const fallbackAt=(burst,rank)=>{
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  const m={...EarthBackdrop.sample(4.43,profile(rank)),burst};
  backdrop.fallback(ctx,390,844,4.43,m,regions,1);
  return Buffer.from(ctx.getImageData(0,0,390,844).data);
};
for(const rank of ['E','D'])assert.ok(fallbackAt(0,rank).equals(fallbackAt(1,rank)),rank+' fallback has no impact-driven displacement or light');

const late=EarthBackdrop.sample(6.65,profile('SS'));
assert.equal(late.burst,0,'primary wave has already faded before its echo');
const lateEcho=echo=>{
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  backdrop.fallback(ctx,390,844,6.65,{...late,echo},regions,1);
  return Buffer.from(ctx.getImageData(0,0,390,844).data);
};
assert.ok(!lateEcho(1).equals(lateEcho(0)),'fallback echo keeps fading after the primary wave finishes');

const actionCanvas=createCanvas(390,844),actionContext=actionCanvas.getContext('2d');
backdrop.draw(actionContext,390,844,{time:20,actionTime:.3,hostTime:30,profile:profile('SS'),box,readout});
assert.equal(backdrop.frame.burst,0,'ambient clock alone cannot trigger a result impact');
backdrop.draw(actionContext,390,844,{time:20.1,actionTime:4.43,hostTime:30.1,profile:profile('SS'),box,readout});
assert.ok(backdrop.frame.burst>0,'the result action clock triggers the background pulse');
assert.equal(backdrop.lastTime,20.1);assert.equal(backdrop.lastActionTime,4.43);

const quietPulse=(hostTime,rank='E',actionTime=.3)=>{
  const c=createCanvas(390,844),ctx=c.getContext('2d');
  backdrop.draw(ctx,390,844,{time:.5,actionTime,hostTime,profile:profile(rank),box,readout});
  return Buffer.from(ctx.getImageData(0,0,390,844).data);
};
const idle=quietPulse(0),wave=quietPulse(.5),draws=backdrop.drawCount;
assert.ok(!wave.equals(idle),'E has a visible regular energy wave without a rock collision');
assert.ok(wave.equals(quietPulse(.5)),'paused periodic pulse remains identical');assert.equal(backdrop.drawCount,draws);
assert.ok(wave.equals(quietPulse(2.5)),'regular wave repeats on host time even when action and material are held');
for(const rank of ['E','D','C','B','A','S','SS']){
  quietPulse(.5,rank,4.43);assert.deepEqual(backdrop.periodicFrame,EarthBackdrop.periodic(.5),'rank and action changes do not restart the periodic pulse');
}

const ctx=createCanvas(16,16).getContext('2d');
for(const [w,h] of [[0,16],[16,0],[-1,16],[NaN,16],[16,Infinity]])assert.equal(backdrop.draw(ctx,w,h),false,'invalid viewport does not draw');
backdrop.dispose();backdrop.dispose();assert.equal(backdrop.draw(ctx,16,16),false,'disposed background cannot draw');
assert.equal(backdrop.canvas.width,1);assert.equal(backdrop.patch.width,1);
console.log('Earth backdrop CPU passed: contact-synced energy waves, continuous rank strength, protected regions, deterministic Canvas fallback, retained 30fps, pause/rewind and disposal.');
