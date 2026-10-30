'use strict';
const assert=require('node:assert/strict');
require('../js/light-angel-motion.js');
require('../js/light-feathers.js');

const view={width:390,height:844};
const makeBurst=(kind='awakening',at=2)=>({at,kind,x:195,y:310});
const frame=(time,bursts=[makeBurst()],viewport=view)=>LightFeathers.samples({...viewport,time,bursts});
const radius=f=>Math.hypot(f.x-f.originX,f.y-f.originY);

assert.deepEqual(frame(-1),[],'negative clocks cannot emit feathers');
assert.deepEqual(frame(1.99),[],'particles cannot appear before their scheduled burst');
assert.deepEqual(frame(3,[]),[],'no events means no particles');
assert.deepEqual(frame(40),[],'a one-shot burst drains completely rather than looping');

const events=Object.freeze([Object.freeze(makeBurst())]);
const before=JSON.stringify(events);
const early=frame(2.8,events),later=frame(3.4,events);
assert.ok(early.length>5,'the awakening now has a substantial feather release');
assert.ok(later.length>0,'feathers remain alive through the wing handoff');
assert.equal(new Set(early.map(f=>f.id)).size,early.length,'particle IDs are unique');
assert.deepEqual(frame(2.8,events),early,'a paused repaint is identical');
frame(20,events);
assert.deepEqual(frame(2.8,events),early,'replay/seek does not depend on earlier frames');
assert.equal(JSON.stringify(events),before,'sampling cannot mutate the host schedule');

const joined=later.map(f=>[early.find(e=>e.id===f.id),f]).filter(([e])=>e);
assert.ok(joined.length>3,'enough matching particles survive for depth continuity');
const outward=joined.filter(([a,b])=>radius(b)>radius(a));
assert.ok(outward.length>joined.length*.65,'the release travels away from its fixed birthplace');
const approaching=joined.filter(([a,b])=>b.length>a.length*1.1&&b.blur>a.blur&&b.depth>a.depth);
assert.ok(approaching.length>0,'some feathers enlarge and soften while approaching the camera');
assert.ok(new Set(early.map(f=>Math.round(f.length))).size>2,'the release has visible size diversity');
assert.ok(new Set(early.map(f=>Math.round(f.rotation*10))).size>2,'feathers do not share one rigid orientation');

// A release loses its initial outward momentum and settles into a floating
// path. Compare screen-space movement, not implementation-specific easing.
const velocity=(start,end)=>{
  const a=frame(start),dt=end-start;
  return frame(end).map(b=>({a:a.find(f=>f.id===b.id),b})).filter(pair=>pair.a)
    .map(({a,b})=>({id:a.id,speed:Math.hypot(b.x-a.x,b.y-a.y)/dt}));
};
const releaseSpeed=velocity(2.7,2.9),floatingSpeed=velocity(3.8,4.0);
const slowed=floatingSpeed.filter(b=>b.speed<releaseSpeed.find(a=>a.id===b.id).speed*.8);
assert.ok(slowed.length>floatingSpeed.length*.75,'most feathers decelerate after the initial release');
const middle=frame(4.0),curving=middle.filter(b=>{
  const a=early.find(f=>f.id===b.id);if(!a)return false;
  const ax=a.x-a.originX,ay=a.y-a.originY,bx=b.x-b.originX,by=b.y-b.originY;
  return Math.abs(ax*by-ay*bx)/(Math.hypot(ax,ay)*Math.hypot(bx,by))>.06;
});
assert.ok(curving.length>middle.length*.35,'sideways sway and updraft bend the trajectories');
assert.ok(frame(6.0).length>0,'the lighter feathers keep drifting beyond the old short burst lifetime');
for(const [a,b] of [[frame(3.4),frame(3.5)],[frame(4.4),frame(4.5)]]){
  for(const f of a){const next=b.find(n=>n.id===f.id);if(!next)continue;
    assert.ok(Math.abs(next.rotation-f.rotation)<.12,'gentle rocking replaces fast continuous spinning');
    assert.ok(next.roll>=.65,'turning keeps a readable broad feather face');
  }
}

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  for(const time of [2.05,2.4,2.8,3.4,4.4,5.4]){
    for(const f of frame(time,[makeBurst()],viewport)){
      for(const key of ['age','x','y','length','alpha','blur','depth','rotation','roll','originX','originY'])
        assert.ok(Number.isFinite(f[key]),`${key} is finite at ${time}`);
      assert.ok(f.length>0&&f.length<Math.max(viewport.width,viewport.height),'bounded positive feather size');
      assert.ok(f.alpha>=0&&f.alpha<=1,'opacity remains valid');
      assert.ok(f.blur>=0,'soft focus radius cannot be negative');
      assert.ok(Math.abs(f.roll)>0,'feather plane never collapses to a line');
      assert.equal(f.originX,195);assert.equal(f.originY,310);
    }
  }
}

const profiles=['A','S','SS'].map(kind=>frame(2.8,[makeBurst(kind)]));
assert.ok(profiles.every((frames,i)=>frames.length>0&&frames.every(f=>f.burstKind===['A','S','SS'][i])),
  'each completed wing stage can release its own identifiable burst');
assert.deepEqual(profiles.map(p=>p.length),[7,10,13],'every growth release is half its original count; SS is not halved twice');
const allProfiles=[frame(2.8),...profiles];
assert.equal(allProfiles[0].length,10,'awakening also uses half its original 20 feathers');
assert.ok(allProfiles.every(p=>p.every(f=>f.alpha<=.5&&f.brightness===1.25)),'the whole light sequence is translucent and brighter');
assert.ok(allProfiles.every(p=>p.some(f=>f.alpha===.5)),'fully arrived feathers peak at 50% opacity in every phase');
const scheduled=[makeBurst('awakening',1.14),makeBurst('A',2.5),makeBurst('S',4.8),makeBurst('SS',7.0)];
assert.ok(frame(2.0,scheduled).every(f=>f.burstKind==='awakening'),'future evolutions cannot leak into the opening');
assert.ok(frame(5.6,scheduled).some(f=>f.burstKind==='S'),'the S completion burst appears on its own clock');
assert.ok(frame(7.8,scheduled).some(f=>f.burstKind==='SS'),'the SS completion burst appears on its own clock');
assert.deepEqual(frame(20,scheduled),[],'all completion bursts end without accumulating particles');

// Growth releases follow the opening feather banks, instead of being delayed
// until the next silhouette is complete. Each dropped feather retains the
// actual wing location at its own birth as the layout continues to move.
const smooth=n=>{const p=Math.max(0,Math.min(1,n));return p*p*(3-2*p);};
for(const [from,rank,count] of [['A','S',10],['S','SS',13]]){
  const at=5,duration=1.2;
  const options={kind:rank,rank,from,at,duration,evolving:true,
    layoutAt:delay=>({cx:195,cy:310-delay*12,width:300}),
    poseAt:delay=>({time:4+delay*.75,progress:smooth(delay/duration)})};
  const burst=LightFeathers.wingBurst(options);
  assert.equal(burst.births.length,count,'growth retains the reduced total population');
  assert.ok(burst.births.every(b=>b.delay>0&&b.delay<duration),'all detachments occur during feather formation');
  assert.ok(burst.births.some(b=>b.side<0)&&burst.births.some(b=>b.side>0),'both wings shed');
  assert.ok(burst.births.every(b=>Math.abs(b.x-195)>8),'feathers detach from wing areas rather than the center');
  assert.ok(new Set(burst.births.map(b=>Math.round(b.delay*100))).size>3,'release is distributed across the growing feather banks');
  assert.deepEqual(frame(at-.01,[burst]),[],'no target-rank feathers before its growth starts');
  const during=frame(at+duration*.65,[burst]);
  assert.ok(during.length>0&&during.length<count,'some feathers drop while the silhouette is still growing');
  const complete=frame(at+duration+.7,[burst]);
  assert.equal(complete.length,count,'completion does not add another burst');
  for(const f of during){
    const next=complete.find(n=>n.id===f.id);
    assert.ok(next);assert.equal(next.originX,f.originX);assert.equal(next.originY,f.originY);
    assert.equal(next.detachedAt,f.detachedAt);assert.ok(f.detachedAt>=at&&f.detachedAt<at+duration);
    assert.ok(f.alpha<=.5&&f.brightness===1.25);
  }
  assert.deepEqual(LightFeathers.wingBurst(options),burst,'rebuilding a paused/replayed release gives identical births');
  assert.deepEqual(frame(at+20,[burst]),[],'detached feathers eventually clear');
}
console.log('PASS light feathers: one-shot release, outward deceleration, curved floating drift, stable pause/replay, unchanged translucency/counts, during-growth shedding from both wings and frozen individual birth locations.');
