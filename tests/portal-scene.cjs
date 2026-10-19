const assert=require('node:assert/strict');
require('../js/config.js');
require('../js/portal-scene.js');

function harness(width=390,height=844) {
  const stats={gradients:0,textures:0,images:0,dots:0};
  const finite=args=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),'canvas coordinates must be finite');};
  function context() {
    const stack=[];let alpha=1,composite='source-over';
    return {
      get globalAlpha(){return alpha;},
      set globalAlpha(value){assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'opacity must stay in [0,1]');alpha=value;},
      get globalCompositeOperation(){return composite;},
      set globalCompositeOperation(value){assert.equal(value,'source-over','portal does not add overlapping light into white');composite=value;},
      createRadialGradient(...args){finite(args);stats.gradients++;return {addColorStop(offset,color){assert.ok(offset>=0&&offset<=1);assert.equal(typeof color,'string');}};},
      save(){stack.push([alpha,composite]);},
      restore(){assert.ok(stack.length);[alpha,composite]=stack.pop();},
      fillRect(...args){finite(args);},translate(...args){finite(args);},rotate(...args){finite(args);},scale(...args){finite(args);},
      drawImage(...args){finite(args);stats.images++;},
      moveTo(...args){finite(args);},quadraticCurveTo(...args){finite(args);},closePath(){},
      beginPath(){},arc(...args){finite(args);assert.ok(args[2]>0);stats.dots++;},fill(){}
    };
  }
  const c=context();
  const scene=new PortalScene(c,width,height,()=>{stats.textures++;return {getContext:()=>context()};});
  return {scene,stats};
}

const {scene,stats}=harness();
const mists=scene.mists,dots=scene.dots,refs=[...mists,...dots];
const initialAngles=refs.map(q=>q.angle);
scene.step(1/60);
for(let i=0;i<refs.length;i++) {
  const delta=(refs[i].angle-initialAngles[i]+Math.PI*2)%(Math.PI*2);
  assert.ok(delta>0&&delta<0.01,'positive canvas angle moves clockwise even in standby');
}
const dotTravel=scene.dots.map((q,i)=>(q.angle-initialAngles[mists.length+i]+Math.PI*2)%(Math.PI*2));
assert.ok(Math.max(...dotTravel)>Math.min(...dotTravel)*2,'dots move at visibly different individual speeds');
const averageTravel=near=>dotTravel.filter((_,i)=>near?dots[i].depth>.75:dots[i].depth<.25).reduce((sum,v,_,arr)=>sum+v/arr.length,0);
assert.ok(averageTravel(true)>averageTravel(false),'near dots move faster than distant dots');
assert.equal(scene.down(0,5,10,0),true,'pointer id zero is valid');
assert.equal(scene.down(2,320,700,0),false,'second finger cannot take ownership');
assert.equal(scene.move(2,320,700,0),false);
assert.equal(scene.release(2),false);
const initialSpeed=scene.speed;
scene.step(1/60);
assert.ok(scene.speed>initialSpeed&&scene.speed<scene.activeSpeed,'press eases into motion');
for(let frame=0;frame<59;frame++)scene.step(1/60);
const gain=scene.activeSpeed-scene.idleSpeed;
assert.ok(Math.abs(scene.speed-(scene.idleSpeed+gain*.5))<.001,'one second reaches half the speed gain');
for(let frame=0;frame<61;frame++)scene.step(1/60);
assert.equal(scene.speed,scene.activeSpeed,'two-second hold reaches configured maximum');
assert.equal(scene.activeSpeed,Math.PI*2,'baseline maximum is one turn per second');
let rotation=0;
for(let frame=0;frame<60;frame++){
  const before=scene.phase;scene.step(1/60);
  rotation+=(scene.phase-before+Math.PI*2)%(Math.PI*2);
}
assert.ok(Math.abs(rotation-Math.PI*2)<1e-8,'maximum baseline completes a full turn in one second');
assert.equal(scene.release(0),true);
const heldSpeed=scene.speed;
scene.step(1/60);
assert.ok(scene.speed<heldSpeed&&scene.speed>scene.idleSpeed,'release decelerates without a snap');
for(let frame=0;frame<120;frame++)scene.step(1/60);
assert.equal(scene.speed,scene.idleSpeed,'two-second release returns to idle');
assert.equal(scene.release(),false);

const other=harness().scene;
const startRadii=scene.mists.map(q=>q.radius),turns=scene.mists.map(()=>0);
for(let frame=0;frame<1200;frame++){
  const angles=scene.mists.map(q=>q.angle);
  scene.step(1/60);
  scene.mists.forEach((q,i)=>turns[i]+=(q.angle-angles[i]+Math.PI*2)%(Math.PI*2));
}
assert.ok(Math.max(...turns)>Math.min(...turns)*2,'clouds visibly overtake one another instead of rotating as one ring');
assert.ok(scene.mists.some((q,i)=>Math.abs(q.radius-startRadii[i])>scene.radius*.014),'clouds retain visible drift within the narrower edge band');
assert.ok(scene.mistDrawOrder.every((q,i)=>i===0||q.depth>=scene.mistDrawOrder[i-1].depth),'back-to-front cloud layers remain stable');
scene.reset();other.reset();scene.down(1,0,0,0);other.down(1,390,844,0);
for(let frame=0;frame<120;frame++) {
  scene.move(1,frame*4,frame*2,frame*16);
  scene.step(1/60);other.step(1/60);
}
assert.deepEqual(scene.dots,other.dots,'finger location and dragging cannot attract or steer dots');
assert.deepEqual(scene.mists,other.mists,'finger location and dragging cannot attract or steer mist');

const allocatedGradients=stats.gradients,allocatedTextures=stats.textures;
const random=Math.random;Math.random=()=>{throw Error('frame loop must not need random allocations');};
try {
  for(let frame=0;frame<60*120;frame++) {
    scene.step(1/60);
    if(frame%20===0)scene.draw(frame%40===0?{name:'LOW'}:{name:'HIGH'});
    assert.ok(scene.phase>=0&&scene.phase<Math.PI*2);
    assert.ok(scene.speed>=scene.idleSpeed&&scene.speed<=scene.activeSpeed);
  }
}finally{Math.random=random;}
assert.equal(scene.mists,mists);assert.equal(scene.dots,dots);
assert.ok(refs.every((q,i)=>q===(i<mists.length?scene.mists[i]:scene.dots[i-mists.length])),'fixed object pools survive long interactions');
assert.equal(stats.gradients,allocatedGradients,'frames reuse cached gradients');
assert.equal(stats.textures,allocatedTextures,'frames reuse cached textures');
assert.ok(stats.images>0&&stats.dots>0,'draws both cloud textures and white dots');

for(const [width,height] of [[390,844],[844,390],[1440,900]]) {
  scene.resize(width,height);scene.draw();
  assert.equal(scene.cx,width/2);assert.equal(scene.cy,height/2);
  assert.ok(scene.radius<=260);
  for(const q of [...scene.mists,...scene.dots]) {
    const normalized=Math.hypot((q.x-scene.cx)/scene.radiusX,(q.y-scene.cy)/scene.radiusY)/q.orbitScale;
    assert.ok(Math.abs(normalized-q.radius/scene.radius)<1e-8,'orbit follows viewport ellipse in portrait and landscape');
    assert.ok(normalized>.9&&normalized<1.1,'clouds and dots occupy the outer band');
    if(q.band!==undefined)assert.ok(Number.isFinite(q.tangent),'fog turns smoothly along ellipse');
    if(q.orbitScale===1)assert.ok(q.x>=0&&q.x<=width&&q.y>=0&&q.y<=height,'inner dots remain within viewport');
  }
  assert.equal(scene.dots.filter(q=>q.outer).length,48,'outer fog contains 48 dots across multiple ellipses');
  assert.ok(scene.mists.some(q=>q.x<0||q.x>width||q.y<0||q.y>height),'outer ellipses extend beyond the viewport');
  const pool=[...scene.mists,...scene.dots];
  assert.ok(Math.min(...pool.map(q=>q.x))<width*.12&&Math.max(...pool.map(q=>q.x))>width*.88,'orbit covers both side edges');
  assert.ok(Math.min(...pool.map(q=>q.y))<height*.12&&Math.max(...pool.map(q=>q.y))>height*.88,'orbit covers top and bottom edges');
  scene.reset();
  for(const sx of [-1,1])for(const sy of [-1,1]) {
    assert.ok(scene.mists.some(q=>(q.x-scene.cx)*sx>width*.36&&(q.y-scene.cy)*sy>height*.36),'fog reaches every corner');
  }
}
scene.reset();assert.equal(scene.time,0);assert.equal(scene.phase,0);assert.equal(scene.speed,scene.idleSpeed);assert.equal(scene.pointer.id,null);
const before=scene.time;scene.step(NaN);scene.step(-1);assert.equal(scene.time,before);
scene.step(1000);assert.equal(scene.time,0.05,'a resumed frame cannot jump the scene ahead');
const stars=harness().scene,starPool=stars.sparkles,starRefs=starPool.slice();
function measureStars(frames,limit) {
  let total=0,peak=0;
  for(let i=0;i<frames;i++) {
    stars.step(1/60);
    const visible=stars.sparkles.filter(q=>q.active);
    assert.ok(visible.length<=limit,'sparkles remain bounded to prevent crowding');
    for(const q of visible) {
      assert.ok(q.age>=0&&q.age<q.life&&q.life>=.8&&q.life<=1.4);
      const orbit=Math.hypot((q.x-stars.cx)/stars.radiusX,(q.y-stars.cy)/stars.radiusY);
      assert.ok(orbit>=.94-1e-8&&orbit<=1.34+1e-8,'sparkles stay in the fog, leaving the center dark');
    }
    total+=visible.length;peak=Math.max(peak,visible.length);
    if(i%30===0)stars.draw();
  }
  return {average:total/frames,peak};
}
const idleStars=measureStars(600,3);
stars.down(1);measureStars(120,5);
const heldStars=measureStars(600,5);
assert.ok(idleStars.peak>0&&heldStars.average>idleStars.average*1.5,'hold visibly increases sparkle activity');
const frozen=JSON.stringify(stars.sparkles);stars.step(0);
assert.equal(JSON.stringify(stars.sparkles),frozen,'paused animation does not advance sparkle life');
stars.release();measureStars(210,5);
measureStars(180,3);
assert.equal(stars.sparkles,starPool);
assert.ok(starRefs.every((q,i)=>q===stars.sparkles[i]),'sparkles reuse their fixed pool');
stars.reset();assert.ok(stars.sparkles.every(q=>!q.active),'restart clears old sparkles');
console.log('Portal scene: viewport ellipse, two-second acceleration, one turn per second, clockwise depth motion, fixed pools and cached rendering passed.');
