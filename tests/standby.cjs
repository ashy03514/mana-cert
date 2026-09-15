const assert=require('node:assert/strict');
require('../js/config.js');require('../js/magic-interaction.js');require('../js/standby-magic.js');require('../js/particle-renderer.js');
const idle=new StandbyMagic(),field=new MagicField(ManaConfig.interaction,390,844,()=>0.43);
const pool=field.particles,refs=pool.slice(),events=new Set();let previous=-1,starts=[];
const realRandom=Math.random;Math.random=()=>{throw Error('idle must not draw results or allocate random events');};
try {
  for(let i=0;i<60*120;i++){
    idle.step(1/60,true);field.step(1/60,0,idle);
    assert.ok(idle.weight>=0&&idle.weight<=1,'long idle must keep blend weight in [0,1]');
    if(idle.event>=0){events.add(idle.event);if(previous<0)starts.push(idle.time);}
    previous=idle.event;
    assert.equal(field.pointer.id,null);assert.equal(field.gathering,false);
    assert.ok(field.particles.every(q=>Number.isFinite(q.x+q.y+q.vx+q.vy)));
  }
}finally{Math.random=realRandom;}
assert.equal(events.size,5);assert.ok(starts.every((v,i)=>!i||v-starts[i-1]>4),'events stay separated');
assert.equal(field.particles,pool);assert.ok(pool.every((q,i)=>q===refs[i]));
for(let i=0;i<11;i++)idle.step(0.05,false);
assert.equal(idle.weight,0,'touch must exit idle within half a second even after two minutes');
const q=pool[0],a={...idle.home(q,0,390,844)},b={...idle.home(q,1,390,844)};
assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>1,'local circulation differs from the main orbit');
idle.reset();assert.equal(idle.time,0);assert.equal(idle.event,-1);assert.equal(idle.weight,1);
const positions=pool.map(q=>[q.x,q.y]);field.down(1,80,200,0);
assert.deepEqual(pool.map(q=>[q.x,q.y]),positions,'touch does not replace or reposition the idle particles');
idle.step(0.05,false);assert.ok(idle.weight>0&&idle.weight<1);
for(let i=0;i<15;i++)idle.step(0.05,false);assert.equal(idle.weight,0);
let textures=0,draws=0,strokes=0;const ctx=new Proxy({}, {set:(target,key,value)=>{
  if(key==='globalAlpha')assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'canvas opacity must stay valid');
  target[key]=value;return true;
},get:(target,key)=>key in target?target[key]:key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  if(key==='drawImage')draws++;if(key==='stroke')strokes++;
  for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));
}});
const renderer=new MagicRenderer(ctx,field,()=>{textures++;return {getContext:()=>ctx};});
idle.reset();for(let i=0;i<120;i++){idle.step(1/60,true);renderer.draw(0,0,{name:'LOW',glow:false,particleStep:2,trailStep:2},idle);}
assert.equal(textures,4);assert.ok(draws>0&&strokes>0,'fog and quiet filaments exist at LOW quality');
console.log('Standby checks passed: five spaced events, multi-scale motion, stable pools, touch continuity, quiet fog at LOW quality.');
