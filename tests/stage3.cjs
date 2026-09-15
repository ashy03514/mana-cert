const assert=require('node:assert/strict');
require('../js/config.js');require('../js/resonance.js');require('../js/magic-interaction.js');require('../js/ritual-renderer.js');
const C=ManaConfig;
function simulate(mode,hz=60){
  const r=new Resonance(C.resonance,C.timing),p={id:mode==='tap'?null:1,turn:mode==='circle'?4:0};r.touch();
  for(let i=0;i<hz*7&&!r.complete;i++){
    if(mode==='slide'||mode==='circle')r.move((mode==='circle'?600:220)/hz);
    r.step(1/hz,p);
  }
  assert.equal(r.complete,true);assert.equal(r.value,1);return r.elapsed;
}
const tap=simulate('tap'),still=simulate('still'),slide=simulate('slide'),circle=simulate('circle');
assert.ok(tap>=6&&tap<6.03);assert.ok(still<tap);assert.ok(slide<still);assert.ok(circle<slide);
for(const mode of ['tap','still','slide','circle']) {
  const at30=simulate(mode,30),at120=simulate(mode,120);
  assert.ok(at30>=2.8&&at120>=2.8);assert.ok(Math.abs(at30-at120)<0.05,'frame-rate independent pacing');
}
const resonance=new Resonance(C.resonance,C.timing);
for(let i=0;i<10000;i++){resonance.touch();resonance.move(100000);}
resonance.step(2.79,{id:1,turn:10});assert.equal(resonance.complete,false,'no gesture can bypass minimum time');
resonance.reset();resonance.touch();resonance.step(1,{id:1,turn:0});const before=resonance.value;
resonance.step(1,{id:null,turn:0});assert.ok(resonance.value>=before,'release preserves accumulated resonance');
resonance.reset();assert.equal(resonance.elapsed,0);assert.equal(resonance.value,0);assert.equal(resonance.distanceEnergy,0);
// Preserve actual objects, locations, trail life and momentum at takeover.
const field=new MagicField(C.interaction,390,844,()=>0.4);
field.down(1,10,10,0);field.move(1,380,800,100);field.step(0.016);
const particles=field.particles,trails=field.trails;
const p0=particles[0],t0=trails.find(t=>t.life>0),px=p0.x,py=p0.y,tx=t0.x,ty=t0.y,life=t0.life;
field.takeControl();field.step(0.016,0);
assert.equal(p0.x,px);assert.equal(p0.y,py);assert.equal(t0.x,tx);assert.equal(t0.y,ty);assert.equal(t0.life,life);
field.step(0.016,0.5);assert.equal(t0.life,life,'live trails survive until absorbed');
assert.ok(Math.hypot(p0.x-195,p0.y-422)<Math.hypot(px-195,py-422));
field.resize(844,390);field.step(0.016,1);
for(const q of [...particles,...trails.filter(t=>t.life>0)]){
  assert.equal(q.x,422);assert.equal(q.y,195);
}
assert.equal(field.particles,particles);assert.equal(field.trails,trails);
field.reset();assert.equal(field.gathering,false);assert.ok(trails.every(t=>t.life===0));
// Trace the actual renderer: standby has no seal/core; layers appear in order;
// completed seal, gather and reveal share the exact viewport center.
let textures=0;const calls=[];
const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'finite draw values');
  calls.push([key,...args]);
}});
const renderer=new RitualRenderer(ctx,()=>{textures++;return {getContext:()=>ctx};});
function draw(state,value,progress=0,w=390,h=844){calls.length=0;renderer.draw(w,h,state,value,progress,1,'水');return calls.slice();}
let operations=draw('STANDBY',0);assert.equal(operations.filter(x=>['stroke','fill','drawImage'].includes(x[0])).length,0);
const first=draw('INTERACTION',0.2),middle=draw('INTERACTION',0.6),full=draw('RESONANCE_COMPLETE',1);
assert.ok(first.some(x=>x[0]==='arc'));assert.equal(first.some(x=>x[0]==='bezierCurveTo'),false);
assert.ok(middle.filter(x=>x[0]==='stroke').length>first.filter(x=>x[0]==='stroke').length);
assert.ok(full.some(x=>x[0]==='bezierCurveTo'));assert.equal(full.some(x=>x[0]==='drawImage'),false,'core waits for absorption');
for(const [w,h] of [[390,844],[844,390]]){
  const core=draw('GATHER',1,0.8,w,h);
  assert.deepEqual(core.find(x=>x[0]==='translate'),['translate',w/2,h/2]);
  assert.ok(core.some(x=>x[0]==='clip')&&core.some(x=>x[0]==='ellipse')&&core.some(x=>x[0]==='drawImage'));
}
draw('ELEMENT_REVEAL',1,1);assert.equal(textures,2,'no per-frame core textures');
console.log(`Stage 3 checks passed: tap ${tap.toFixed(2)}s, still ${still.toFixed(2)}s, slide ${slide.toFixed(2)}s, circle ${circle.toFixed(2)}s; pacing, continuous gather, seal and core.`);
