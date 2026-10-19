const assert=require('node:assert/strict');require('../js/config.js');require('../js/magic-interaction.js');
const make=()=>new MagicField(ManaConfig.interaction,390,844,()=>.43);
const idle=make(),held=make();held.down(1,195,422,0);
for(let i=0;i<300;i++){idle.step(1/60);held.step(1/60);}
assert.deepEqual(held.mistClouds,idle.mistClouds,'holding does not attract mist');
const f=make(),q=f.mistClouds[0];q.x=195;q.y=410;q.vx=q.vy=0;
f.down(1,80,422,0);f.move(1,310,422,100);assert.ok(q.vy<0,'swept gesture pushes nearby mist away');
const refs=f.mistClouds.slice();for(let i=0;i<7200;i++)f.step(1/60);
assert.ok(f.mistClouds.every((c,i)=>c===refs[i]&&Number.isFinite(c.x+c.y)&&c.x>=-30&&c.x<=420&&c.y>=-30&&c.y<=874));
f.reset();assert.ok(f.mistClouds.every(c=>c.vx===0&&c.vy===0));
console.log('Mist checks passed: independent drift, no hold attraction, swept repulsion, bounded lifetime and reset.');
