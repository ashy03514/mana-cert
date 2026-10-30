const assert=require('node:assert/strict');
require('../js/rank-lettering.js');
const R=RankLettering;
let count=0,glow=0;
for(const rank of ['E','D','C','B','A','S','SS']){
 const p=R.profiles[rank];assert.ok(p.count>count&&p.glow>glow);count=p.count;glow=p.glow;
 const start=R.frames(rank,2),next=R.frames(rank,2.03),later=R.frames(rank,8);
 assert.equal(start.length,p.count);assert.deepEqual(R.frames(rank,2),start,'paused clock freezes stars');
 assert.notDeepEqual(start,later,'new lifetimes regenerate locations');
 for(let i=0;i<start.length;i++){
  const a=start[i],b=next[i];
  for(const value of Object.values(a))assert.ok(Number.isFinite(value));
  assert.ok(a.scale>=0&&a.scale<=1&&a.opacity>=0&&a.opacity<=1);
  if(a.cycle===b.cycle){assert.equal(a.x,b.x);assert.equal(a.y,b.y);}
 }
 assert.ok(start.some((a,i)=>a.rotation!==next[i].rotation));
 assert.ok(start.some((a,i)=>a.scale!==next[i].scale));
}
assert.deepEqual(R.frames('—',10),[]);
console.log('PASS rank glow/star intensity increases E to SS, deterministic pause, stable spawn positions, pulsing and rotation, new random positions each lifecycle.');
