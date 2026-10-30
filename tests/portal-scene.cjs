const assert=require('node:assert/strict');
require('../js/config.js');
require('../js/effect-settings.js');
// Portal ownership is isolated from ribbon rendering; the page suite covers integration.
globalThis.FingerTrails=class {
  resize(w,h){this.width=w;this.height=h;}
  reset(){this.events=[];}
  down(...args){this.events.push(['down',...args]);}
  move(...args){this.events.push(['move',...args]);}
  release(){this.events.push(['release']);}
  step(){}
  draw(){}
};
require('../js/portal-scene.js');
const {MagicTrailReference}=require('./fixtures/magic-trail-reference.cjs');
const TAU=Math.PI*2;
const referenceSettings={mistCount:30,mistColor1:'#6457a2',mistColor2:'#6457a2',mistColor3:'#6457a2',
  dotCount:55,dotColor:'#d7dbf6',starEnabled:false,backgroundCenter:'#080915',backgroundOuter:'#24223f'};

function harness(width=390,height=600,settings=referenceSettings) {
  const stats={gradients:0,textures:0,images:0,dots:0};
  const finite=args=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),'canvas coordinates must be finite');};
  function context() {
    const stack=[];let alpha=1,composite='source-over',fillStyle='';
    const events=[];
    return {
      events,
      get globalAlpha(){return alpha;},
      set globalAlpha(value){assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'opacity must stay in [0,1]');alpha=value;},
      get globalCompositeOperation(){return composite;},
      set globalCompositeOperation(value){assert.equal(value,'source-over');composite=value;},
      get fillStyle(){return fillStyle;},
      set fillStyle(value){fillStyle=value;},
      createRadialGradient(...args){
        finite(args);stats.gradients++;
        return {kind:'radial',args,stops:[],addColorStop(offset,color){assert.ok(offset>=0&&offset<=1);this.stops.push([offset,color]);}};
      },
      save(){stack.push([alpha,composite,fillStyle]);},
      restore(){assert.ok(stack.length);[alpha,composite,fillStyle]=stack.pop();},
      fillRect(...args){finite(args);events.push(['rect',args,fillStyle]);},
      translate(...args){finite(args);},rotate(...args){finite(args);},scale(...args){finite(args);},
      drawImage(...args){finite(args);stats.images++;},
      moveTo(...args){finite(args);},quadraticCurveTo(...args){finite(args);},closePath(){},
      setTransform(...args){finite(args);},clearRect(...args){finite(args);},lineTo(...args){finite(args);},stroke(){},
      beginPath(){},arc(...args){finite(args);assert.ok(args[2]>0);stats.dots++;events.push(['arc',args,fillStyle]);},fill(){}
    };
  }
  const c=context();
  const scene=new PortalScene(c,width,height,()=>{stats.textures++;return {getContext:()=>context()};},settings);
  return {scene,stats,c,context};
}
function compare(actual,expected,label) {
  if(typeof actual==='number'&&typeof expected==='number')assert.ok(Math.abs(actual-expected)<1e-10,label);
  else if(Array.isArray(actual)){assert.equal(actual.length,expected.length,label);actual.forEach((v,i)=>compare(v,expected[i],label+'['+i+']'));}
  else if(actual&&typeof actual==='object'){for(const key of Object.keys(actual))if(typeof actual[key]!=='function')compare(actual[key],expected[key],label+'.'+key);}
  else assert.equal(actual,expected,label);
}

// Frozen oracle prevents another approximate interpretation of the approved preview.
for(const time of [0,1.6,12.25]) {
  const h=harness(),reference=new MagicTrailReference();
  h.scene.time=time;h.scene.orbitTime=time;h.scene.positionPools();reference.time=time;
  const expected=h.context();reference.background(expected);h.scene.drawBackground();
  compare(h.c.events,expected.events,'approved background at '+time);
}
const {scene,stats}=harness();
const mists=scene.mists,dots=scene.dots,refs=[...mists,...dots];
const initialAngles=refs.map(q=>q.angle);
scene.step(1/60);
for(let i=0;i<refs.length;i++) {
  const delta=(refs[i].angle-initialAngles[i]+TAU)%TAU;
  assert.ok(delta>0&&delta<.01,'standby remains clockwise');
}
const dotTravel=dots.map((q,i)=>(q.angle-initialAngles[mists.length+i]+TAU)%TAU);
assert.ok(Math.max(...dotTravel)>Math.min(...dotTravel)*2,'dots retain individual speeds');
const meanTravel=near=>dotTravel.filter((_,i)=>near?dots[i].depth>.75:dots[i].depth<.25).reduce((sum,v,_,arr)=>sum+v/arr.length,0);
assert.ok(meanTravel(true)>meanTravel(false),'near dots move faster');
assert.equal(scene.down(0,5,10,123),true,'pointer id zero is valid');
assert.deepEqual(scene.trails.events.at(-1),['down',5,10,123],'press timestamps reach the ribbon');
assert.equal(scene.down(2,320,700,0),false,'second finger cannot take ownership');
assert.equal(scene.move(2,320,700,0),false);assert.equal(scene.release(2),false);
assert.equal(scene.move(0,12,30,149),true);
assert.deepEqual(scene.trails.events.at(-1),['move',12,30,149],'move timestamps reach the ribbon');
const initialSpeed=scene.speed;scene.step(1/60);
assert.ok(scene.speed>initialSpeed&&scene.speed<scene.activeSpeed,'press eases into motion');
for(let frame=0;frame<59;frame++)scene.step(1/60);
const gain=scene.activeSpeed-scene.idleSpeed;
assert.ok(Math.abs(scene.speed-(scene.idleSpeed+gain*.5))<.001,'one second reaches half the speed gain');
for(let frame=0;frame<61;frame++)scene.step(1/60);
assert.equal(scene.speed,scene.activeSpeed,'two-second hold reaches maximum');
assert.equal(scene.activeSpeed,TAU,'baseline maximum stays one turn per second');
let rotation=0;
const heldOrbitTime=scene.orbitTime;
for(let frame=0;frame<60;frame++){const before=scene.phase;scene.step(1/60);rotation+=(scene.phase-before+TAU)%TAU;}
assert.ok(Math.abs(rotation-TAU)<1e-8);
assert.ok(Math.abs((scene.orbitTime-heldOrbitTime)*.04-TAU)<1e-8,'full-hold particle motion averages the configured one turn per second');
assert.equal(scene.release(0),true);
const heldSpeed=scene.speed;scene.step(1/60);
assert.ok(scene.speed<heldSpeed&&scene.speed>scene.idleSpeed,'release decelerates without a snap');
for(let frame=0;frame<120;frame++)scene.step(1/60);
assert.equal(scene.speed,scene.idleSpeed,'two-second release returns to idle');assert.equal(scene.release(),false);

const other=harness().scene;
scene.reset();other.reset();scene.down(1,0,0,0);other.down(1,390,600,0);
for(let frame=0;frame<120;frame++){scene.move(1,frame*4,frame*2,frame*16);scene.step(1/60);other.step(1/60);}
assert.deepEqual(scene.dots,other.dots,'dragging cannot attract or steer dots');
assert.deepEqual(scene.mists,other.mists,'dragging cannot attract or steer mist');
const allocatedTextures=stats.textures;
const random=Math.random;Math.random=()=>{throw Error('animation cannot consume result randomness');};
try {
  for(let frame=0;frame<60*120;frame++) {
    scene.step(1/60);if(frame%20===0)scene.draw(frame%40===0?{name:'LOW'}:{name:'HIGH'});
    assert.ok(scene.phase>=0&&scene.phase<TAU);assert.ok(scene.speed>=scene.idleSpeed&&scene.speed<=scene.activeSpeed);
  }
}finally{Math.random=random;}
assert.equal(scene.mists,mists);assert.equal(scene.dots,dots);
assert.ok(refs.every((q,i)=>q===(i<mists.length?scene.mists[i]:scene.dots[i-mists.length])),'fixed pools survive long interactions');
assert.equal(stats.textures,allocatedTextures,'animation does not allocate new canvases');
assert.ok(stats.gradients>0&&stats.dots>0,'draws the reference haze gradients and points');
for(const [width,height] of [[390,844],[844,390],[1440,900]]) {
  scene.resize(width,height);scene.draw();assert.equal(scene.cx,width/2);assert.equal(scene.cy,height/2);
  for(const q of [...scene.mists,...scene.dots]) {
    assert.ok(Math.abs(q.x-q.referenceX*width/390)<1e-10);assert.ok(Math.abs(q.y-q.referenceY*height/600)<1e-10);
    const fog=scene.mists.includes(q),rx=(fog?190:170)*width/390,ry=(fog?295:260)*height/600;
    const normalized=Math.hypot((q.x-scene.cx)/rx,(q.y-scene.cy)/ry);
    assert.ok(Math.abs(normalized-q.orbitScale)<1e-10,'reference ellipse scales without squaring its orbit');
  }
}
const custom=harness(390,600,{...referenceSettings,mistCount:80,dotCount:150,mistDrift:200,dotSpeed:200,mistSize:150,mistOpacity:130});
assert.equal(custom.scene.mists.length,80);assert.equal(custom.scene.dots.length,150);
const reference=harness().scene;
assert.ok(Math.abs(custom.scene.mists[0].size-reference.mists[0].size*1.5)<1e-10);
assert.ok(Math.abs(custom.scene.mists[0].alpha-reference.mists[0].alpha*1.3)<1e-10);
assert.equal(custom.scene.dots[0].rate,reference.dots[0].rate*2);custom.scene.draw();
const idleFaster=harness(390,600,{...referenceSettings,idleSeconds:40}).scene;
for(let frame=0;frame<60;frame++){reference.step(1/60);idleFaster.step(1/60);}
assert.ok(idleFaster.orbitTime>reference.orbitTime*2,'idle setting affects actual orbital movement');
const disabled=harness(390,600,{mistEnabled:false,dotEnabled:false,starEnabled:false});disabled.scene.draw();
assert.equal(disabled.c.events.length,1,'disabling background effects leaves only its gradient');
scene.reset();assert.equal(scene.time,0);assert.equal(scene.phase,0);assert.equal(scene.orbitTime,0);assert.equal(scene.speed,scene.idleSpeed);assert.equal(scene.pointer.id,null);
const before=scene.time;scene.step(NaN);scene.step(-1);assert.equal(scene.time,before);
scene.step(1000);assert.equal(scene.time,.05,'resumed frames cannot jump the animation');

// Stars are optional, deliberately absent from the approved reference preset.
assert.equal(harness().scene.sparkles.length,0);
const stars=harness(390,844,{...referenceSettings,starEnabled:true}).scene,starPool=stars.sparkles,starRefs=starPool.slice();
function measureStars(frames,limit) {
  let total=0,peak=0;
  for(let i=0;i<frames;i++) {
    stars.step(1/60);const visible=stars.sparkles.filter(q=>q.active);assert.ok(visible.length<=limit);
    for(const q of visible)assert.ok(q.age>=0&&q.age<q.life&&q.life>=.8&&q.life<=1.4);
    total+=visible.length;peak=Math.max(peak,visible.length);if(i%30===0)stars.draw();
  }
  return {average:total/frames,peak};
}
const idleStars=measureStars(600,3);stars.down(1);measureStars(120,5);const heldStars=measureStars(600,5);
assert.ok(idleStars.peak>0&&heldStars.average>idleStars.average*1.5);
const frozen=JSON.stringify(stars.sparkles);stars.step(0);assert.equal(JSON.stringify(stars.sparkles),frozen);
stars.release();measureStars(210,5);measureStars(180,3);assert.equal(stars.sparkles,starPool);
assert.ok(starRefs.every((q,i)=>q===stars.sparkles[i]));stars.reset();assert.ok(stars.sparkles.every(q=>!q.active));
console.log('Portal scene: approved preview backdrop, scaled ellipse, individual depth speeds, settings, two-second acceleration, pointer timestamps and bounded pools passed.');
