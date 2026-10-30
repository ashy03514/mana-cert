'use strict';
const assert=require('node:assert/strict');
require('../js/earth-rank-effects.js');
require('../js/earth-mountain-renderer.js');
const E=EarthMountainRenderer,profiles=EarthRankEffects.profiles;
assert.deepEqual(profiles.map(p=>p.rank),['E','D','C','B','A','S','SS']);
let previousWidth=0;
for(const p of profiles){
  assert.ok(Object.isFrozen(p));
  const r=Object.create(E.prototype);r.profile=p;r.formation=1;
  const catalog=E.stonesForRank(p.rank),width=Math.max(...catalog.map(s=>s.position[0]+s.width))-Math.min(...catalog.map(s=>s.position[0]-s.width));
  assert.ok(width>previousWidth,p.rank+' grows through larger physical structures');previousWidth=width;
  for(const spec of catalog){
    const geometry=E.geometry(spec);assert.ok(geometry.every(Number.isFinite));
    for(const formation of [0,.3,.75,1]){
      r.formation=formation;
      for(const t of [0,3.6,4.43,120]){
        const m=r.model(spec,t);assert.ok(m.every(Number.isFinite));
        for(const col of [0,4,8])assert.ok(Math.abs(Math.hypot(m[col],m[col+1],m[col+2])-1)<1e-9,'formation translates/rotates rigid stone without camera zoom');
      }
    }
  }
  r.formation=1;
  const debris=r.collisionParticles(4.43);
  if(p.rank==='E')assert.equal(debris.length,0,'loose sand does not mimic a mountain collision');
  if(!['S','SS'].includes(p.rank)){
    assert.equal(p.starScale,0);assert.ok(debris.every(v=>v.type!=='spark'));
  }else assert.ok(debris.some(v=>v.type==='spark'));
  r.formation=.8;assert.equal(r.collisionParticles(4.43).length,0,'collision cannot fire before assembly finishes');
}
assert.ok(E.stonesForRank('E').every(p=>p.kind==='boulder'),'E has no complete miniature mountain');
assert.ok(E.stonesForRank('D').every(p=>p.kind==='boulder'),'D develops from separate stones');
assert.ok(E.stonesForRank('A').some(p=>p.kind==='peak'),'mountain peaks begin at A');
assert.ok(E.stonesForRank('S').length<E.stonesForRank('SS').length,'SS retains more structural detail');
assert.equal(EarthRankEffects.forRank('invalid'),EarthRankEffects.forRank('SS'));
// Retain all accepted SS choreography/geometry invariants with the rank module loaded.
require('./earth-mountain.cjs');
console.log('Earth rank CPU passed: seven structures, rigid assembly, physical sizes, collision and sparkle gates.');
