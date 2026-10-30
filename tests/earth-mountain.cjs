'use strict';
const assert=require('node:assert/strict');
require('../js/earth-mountain-renderer.js');
const E=EarthMountainRenderer,r=Object.create(E.prototype);
for(const time of [0,.3,1.3,2.4,3.6,4.75,5.8,6.799,6.8,120,10000]){
  const a=E.sample(time),b=E.sample(time+6.8);
  for(const key of ['phase','charge','opening','impact']){
    assert.ok(Number.isFinite(a[key])&&a[key]>=0&&a[key]<=1);
    assert.ok(Math.abs(a[key]-b[key])<1e-9,'absolute time has the same cycle choreography');
  }
}
for(const time of [-1,NaN,Infinity])assert.deepEqual(E.sample(time),E.sample(0));
assert.ok(E.sample(1.3).charge>.8&&E.sample(1.3).opening===0,'charge begins before lifting');
assert.equal(E.sample(3.6).opening,1,'open inspection exposes the fractured rock faces');
assert.ok(E.sample(4.75).opening<.05&&E.sample(4.75).impact>.5,'compression coincides with the dust impact');
assert.equal(E.sample(5.8).impact,0,'impact settles rather than remaining a permanent explosion');
for(let i=0;i<=380;i++){
  const t=i/100,v=Math.max(0,Math.min(1,(t-1.6)/1.9)),original=v*v*(3-2*v);
  assert.ok(Math.abs(E.sample(t).opening-original)<1e-9,'the entire opening and hold curve stays unchanged');
}
assert.ok(E.sample(4.18).opening<1e-12,'compression now reaches contact in 380 ms');
const earlyTravel=E.sample(3.85).opening-E.sample(3.95).opening;
const lateTravel=E.sample(4.05).opening-E.sample(4.15).opening;
assert.ok(lateTravel>earlyTravel*3,'the closing stroke accelerates into contact');
assert.equal(r.collisionParticles(4.179).length,0,'no seam ejecta before the first contact');
const debris=r.collisionParticles(4.43);
for(const type of ['dust','chip','spark'])assert.ok(debris.filter(p=>p.type===type).length>12,'contact produces '+type);
assert.deepEqual(debris,r.collisionParticles(4.43),'seam ejecta are independent of frame history');
for(const p of debris){
  assert.ok(p.age>=0&&p.age<p.life&&p.contact<=4.43);
  assert.ok([...p.position,...p.source,...p.tail,p.alpha].every(Number.isFinite));
  assert.ok(p.alpha>=0&&p.alpha<=1);
}
assert.ok(debris.some(p=>p.front)&&debris.some(p=>!p.front),'collision jets have front and rear depth');
assert.equal(r.collisionParticles(5.7).length,0,'dust and debris settle before the next cycle');
for(const kind of ['layer','root','peak']){
  const input=Object.freeze({width:1,height:.5,depth:.7,kind,seed:4}),mesh=E.geometry(input);
  assert.ok(mesh.length>500&&mesh.length%18===0,'closed rock is actual triangle geometry');
  assert.deepEqual(mesh,E.geometry(input),'geometry is repeatable and independent of time');
  for(let i=0;i<mesh.length;i+=6){
    assert.ok([...mesh.slice(i,i+6)].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5,'surface normal remains unit length');
  }
}
const spec={position:[-.1,.2,.0],lift:.35,side:.1,seed:4};
for(const t of [0,1.3,3.6,4.75,120]){
  const m=r.model(spec,t);
  for(const col of [0,4,8])assert.ok(Math.abs(Math.hypot(m[col],m[col+1],m[col+2])-1)<1e-9,'opening translates rigid rock instead of scaling it');
  const p=r.project([0,0,0],m,{x:0,y:0,width:390,height:390});
  assert.ok([p.x,p.y,p.z].every(Number.isFinite));
}
assert.ok(r.model(spec,3.6)[13]>r.model(spec,1.3)[13]+.25,'strata have measurable separation at the open phase');
console.log('Earth SS CPU passed: choreography, rigid strata, reproducible closed geometry and normals.');
