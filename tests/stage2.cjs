const assert=require('node:assert/strict');
require('../js/config.js');require('../js/magic-interaction.js');require('../js/particle-renderer.js');
const config=ManaConfig.interaction;
function make(){let seed=17;return new MagicField(config,390,844,()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});}
function advance(f,seconds){for(let t=0;t<seconds;t+=1/60)f.step(1/60);}
const f=make(),idle=make();
assert.equal(f.down(1,80,330,0),true);assert.equal(f.down(2,300,200,0),false);
assert.equal(f.move(2,0,0,100),false);assert.equal(f.release(2),false);
advance(f,0.4);f.move(1,320,400,400);advance(f,0.4);advance(idle,0.8);
assert.ok(f.particles.some((p,i)=>Math.hypot(p.x-idle.particles[i].x,p.y-idle.particles[i].y)>15),'pointer visibly changes particle motion');
const positions=f.particles.map(p=>[p.x,p.y]);
f.release(1);advance(f,0.1);
assert.ok(f.particles.some((p,i)=>Math.hypot(p.x-positions[i][0],p.y-positions[i][1])>2),'inertia continues after release');
advance(f,3);assert.ok(f.pointer.strength<0.001);assert.ok(f.trails.every(t=>t.life===0),'trails dissipate');
// Holding a still finger brings surrounding dust inward, without snapping it to the cursor.
const still=make();still.down(1,240,400,0);
const near=still.particles.filter(p=>p.kind===0&&Math.hypot(p.x-240,p.y-400)<100);
const before=near.reduce((n,p)=>n+Math.hypot(p.x-240,p.y-400),0)/near.length;
advance(still,1.5);
const after=near.reduce((n,p)=>n+Math.hypot(p.x-240,p.y-400),0)/near.length;
assert.ok(after<before*0.8,`stationary attraction: ${before} -> ${after}`);
assert.ok(near.some(p=>Math.hypot(p.x-240,p.y-400)>12),'particles retain individual positions');
// Both circle directions build signed vorticity, without requiring a perfect circle.
for(const direction of [-1,1]){
  const circle=make();circle.down(1,270,420,0);
  for(let i=1;i<=80;i++){const angle=i*0.1*direction;circle.move(1,195+Math.cos(angle)*75,420+Math.sin(angle)*68,i*16);circle.step(0.016);}
  assert.ok(circle.pointer.turn*direction>2,'circle direction is recognized');
}
const slow=make(),fast=make();
for(const q of [slow,fast])q.down(1,40,400,0);
slow.move(1,70,400,100);fast.move(1,350,400,100);
assert.ok(fast.pointer.speed>slow.pointer.speed*2);
assert.ok(fast.trails.filter(t=>t.life>0).length>slow.trails.filter(t=>t.life>0).length,'fling lays down a longer ribbon');
const counts=[];
for(const hz of [60,120]) {
  const sampled=make();sampled.down(1,295,422,0);
  for(let i=1;i<=hz;i++){
    sampled.move(1,195+Math.cos(i/hz*6)*100,422+Math.sin(i/hz*6)*100,i/hz*1000);
    sampled.step(1/hz);
  }
  counts.push(sampled.trails.filter(t=>t.life>0).length);
}
assert.ok(Math.abs(counts[0]-counts[1])<10,`60 / 120 Hz trail counts stay comparable: ${counts}`);
f.reset();f.down(1,20,20,0);f.move(1,60,50,30);f.release(1);f.down(2,380,800,50);
assert.equal(f.pointer.speed,0,'retouch does not fling across the screen');
assert.equal(new Set(f.trails.filter(t=>t.life>0).map(t=>t.stroke)).size,2,'lift separates ribbon strokes');
const pool=f.particles,trailPool=f.trails,particle=pool[0],trail=trailPool[0];
for(let round=0;round<30;round++){
  f.reset();f.down(1,30,30,0);
  for(let i=1;i<=300;i++){
    f.move(1,i%2? -100:2000,i%3?2000:-300,i*8);f.step(0.008);
  }
  for(const p of pool){assert.ok(Number.isFinite(p.x+p.y+p.vx+p.vy));assert.ok(Math.hypot(p.vx,p.vy)<=config.maxSpeed+0.001);}
  f.takeControl();const x=f.pointer.x;assert.equal(f.move(1,300,300,3000),false);assert.equal(f.down(2,0,0,3000),false);assert.equal(f.pointer.x,x);
  for(let i=0;i<90;i++)f.step(1/60,i/90);
  assert.ok(pool.reduce((sum,p)=>sum+Math.hypot(p.x-195,p.y-422),0)/pool.length<25,'existing particles converge for reveal');
}
assert.equal(f.particles,pool);assert.equal(f.trails,trailPool);assert.equal(pool[0],particle);assert.equal(trailPool[0],trail);
f.reset();assert.ok(f.trails.every(t=>t.life===0));assert.equal(f.pointer.turn,0);assert.equal(f.gathering,false);
f.down(5,100,200,0);f.resize(844,390);assert.equal(f.pointer.id,null);assert.equal(f.width,844);assert.ok(f.particles.every(p=>Number.isFinite(p.x+p.y)));
// Render uses cached glow sprites and keeps trails from joining separate touches.
let canvases=0,draws=0,curves=0;
const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  if(key==='drawImage')draws++;if(key==='quadraticCurveTo')curves++;
  for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));
}});
const renderer=new MagicRenderer(ctx,f,()=>{canvases++;return {getContext:()=>ctx};});
f.reset();f.down(1,20,20,0);f.release();f.down(2,25,25,10);
renderer.draw();assert.equal(curves,0,'separate touches do not connect');
f.move(2,80,80,100);
for(let i=0;i<100;i++){f.step(1/60);renderer.draw();}
assert.equal(canvases,3,'textures allocated only once');assert.ok(draws>0&&curves>0);
console.log('Stage 2 checks passed: forces, inertia, circles, flings, retouch, takeover, 30-round pools, resize and renderer.');
