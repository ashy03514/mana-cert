'use strict';
const assert=require('node:assert/strict');
require('../js/ocean-spray-field.js');
const field=OceanSprayField,radius=p=>Math.hypot(p.x,p.y,p.z);
assert.equal(field.maxParticles,3010);
assert.deepEqual(field.sample(1,{breakers:0}),[]);
assert.deepEqual(field.sample(1,{surge:.2}),[]);
assert.deepEqual(field.sample(1,{surge:NaN}),[]);
assert.deepEqual(field.sample(NaN),field.sample(0));
assert.deepEqual(field.sample(-5),field.sample(0));
assert.deepEqual(field.sample(12.345),field.sample(12.345),'seeking a time never rerolls particles');
assert.notDeepEqual(field.sample(12.345),field.sample(12.36),'particles continuously move');
for(const time of [0,.05,.5,1,2,12,112,1800,1000000]){
  const particles=field.sample(time);
  assert.ok(particles.length>300&&particles.length<=field.maxParticles,'bounded populated field at '+time);
  assert.equal(new Set(particles.map(p=>p.id)).size,particles.length,'one particle per stable pool slot');
  assert.deepEqual(new Set(particles.map(p=>p.kind)),new Set([0,1,2]));
  assert.ok(particles.some(p=>p.z>0)&&particles.some(p=>p.z<0),'field wraps the whole sphere before depth testing');
  for(const p of particles){
    for(const key of ['x','y','z','radius','angle','alpha','seed','kind','life','birth','age','lifetime'])assert.ok(Number.isFinite(p[key]),key+' stays finite');
    assert.ok(p.life>=0&&p.life<1);assert.ok(p.alpha>0&&p.alpha<=1);
    assert.ok(p.radius>0&&p.radius<.05);
    assert.ok(radius(p)>1&&radius(p)<1.18,'particles remain close to the wave rather than escaping');
    assert.ok(Math.abs(p.z/radius(p))>.27,'spray fades before the projected rim');
  }
}
const strong=field.sample(.8),weak=field.sample(.8,{surge:.25});
const energy=particles=>particles.reduce((sum,p)=>sum+p.alpha*p.radius*p.radius,0);
assert.ok(energy(strong)>energy(weak)*20,'the small-water seed has only faint spray');
const half=field.sample(.8,{breakers:.5});
assert.ok(energy(half)<energy(strong)&&energy(half)>energy(weak),'breaker intensity changes spray continuously');

// Follow one real droplet through its existing birth interval. Near the centre
// the silhouette fade cannot hide it, so radial height reveals the ballistic arc.
const drop=field.sample(.8).find(p=>p.kind===1&&p.z>.85&&p.birth>0);
assert.ok(drop,'a front-facing droplet exists');
const samples=[.15,.5,.85].map(life=>{
  const time=drop.birth+drop.lifetime*life;
  return field.sample(time).find(p=>p.id===drop.id&&Math.abs(p.birth-drop.birth)<1e-8);
});
assert.ok(samples.every(Boolean),'the same droplet is visible throughout its arc');
assert.ok(radius(samples[1])>radius(samples[0])+.025,'droplet rises above its birth height');
assert.ok(radius(samples[1])>radius(samples[2])+.025,'droplet falls back toward the sea');
assert.ok(samples[2].alpha<samples[1].alpha,'the returning droplet fades into the surface');
const lifeEdge=field.sample(drop.birth+drop.lifetime*.99999).find(p=>p.id===drop.id);
assert.ok(!lifeEdge||lifeEdge.alpha<.001,'the old particle is invisible before its slot recycles');
console.log('Ocean spray field passed: deterministic absolute time, bounded pool, three layers, strength response, limb fade and droplet rise/return.');
