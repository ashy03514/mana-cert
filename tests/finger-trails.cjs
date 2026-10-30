const assert=require('node:assert/strict');
require('../js/effect-settings.js');
require('../js/ribbon-renderer.js');
require('../js/finger-trails.js');
const {MagicTrailReference}=require('./fixtures/magic-trail-reference.cjs');

// Record real Canvas commands, including opacity at final composition. This catches
// invalid geometry and additive glow without claiming device visual acceptance.
function context(){
  const calls=[],state={globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1},stack=[];
  const check=(args,label)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),'finite '+label);};
  const gradient=(...args)=>{
    check(args,'gradient');const stops=[];calls.push({name:'gradient',args,stops});
    return {addColorStop(at,color){assert.ok(at>=0&&at<=1);stops.push([at,color]);}};
  };
  const methods={save(){stack.push({...state});},restore(){assert.ok(stack.length,'balanced Canvas restore');Object.assign(state,stack.pop());},createRadialGradient:gradient,createLinearGradient:gradient};
  return new Proxy(state,{
    get(o,k){
      if(k==='calls')return calls;if(k in methods)return methods[k];if(k in o)return o[k];
      return (...args)=>{check(args,String(k));calls.push({name:k,args,alpha:o.globalAlpha,width:o.lineWidth,color:o.strokeStyle??o.fillStyle});};
    },
    set(o,k,v){
      if(typeof v==='number')assert.ok(Number.isFinite(v),'finite Canvas '+k);
      if(k==='globalAlpha')assert.ok(v>=0&&v<=1,'bounded opacity');
      if(k==='lineWidth')assert.ok(v>0,'positive line width');
      if(k==='globalCompositeOperation')assert.equal(v,'source-over','overlap never uses additive blending');
      o[k]=v;return true;
    }
  });
}
const create=()=>{const c=context();return {getContext:()=>c};};
const make=v=>{const t=new FingerTrails(EffectSettings.normalize(v),create);t.resize(390,844);return t;};
function paint(t){
  // Reset irrelevant recording styles so previous-frame state does not affect
  // command equality. Render methods explicitly set their own paint styles.
  t.layerCtx.strokeStyle=undefined;t.layerCtx.fillStyle=undefined;t.layerCtx.lineWidth=1;
  t.layerCtx.calls.length=0;const destination=context();t.draw(destination);
  const commands=t.layerCtx.calls.map(c=>({...c,color:typeof c.color==='object'?'gradient':c.color}));
  return {commands,composites:destination.calls.filter(c=>c.name==='drawImage')};
}
function drawLine(t,y=200){t.down(20,y,0);for(let x=30;x<=350;x+=10)t.move(x,y,x*2);return t.active;}
function routePoints(t,s){return t.getRoute(s).points;}
function close(a,b,message){assert.ok(Math.abs(a-b)<1e-9,message+': '+a+' vs '+b);}

const t=make({}),layer=t.layer;
assert.equal(layer.width,780,'normal mobile drawing uses the approved 2x resolution');assert.equal(layer.height,1688);
t.down(20,100,0);const first=t.active,stillCommands=paint(t).commands;
for(let i=0;i<1200;i++){t.move(20,100,i*16);t.step(1/60);}
assert.equal(first.points.length,1,'holding still does not append accumulating points');
assert.equal(t.strokes.length,1,'holding still does not create extra strokes');
assert.equal(t.opacity(first),1,'active stroke remains visible during a long hold');
assert.deepEqual(paint(t).commands,stillCommands,'stationary tap remains a bounded soft point without a particle burst');
t.move(70,120,20010);t.move(150,90,20026);
const beforeInvalid=first.points.length;t.move(NaN,10,20030);t.move(10,Infinity,20031);
assert.equal(first.points.length,beforeInvalid,'invalid coordinates cannot poison a drawing');
assert.equal(first.color,'#7deaff','default color is the approved cyan base for the violet blend');
assert.deepEqual(first.rawTip,{x:150,y:90},'unfiltered tip is retained for input ownership');
const composite=paint(t).composites;assert.equal(composite.length,1,'one transparent layer is composited per frame');
close(composite[0].alpha,.86,'final composition matches the preview');
t.release();t.step(2);assert.equal(t.opacity(first),1,'release retention remains complete');
t.step(.75);close(t.opacity(first),.5,'default fade reaches half opacity after .75s');
t.step(.75);assert.equal(t.opacity(first),0,'ink finishes fading after 1.5s');
assert.equal(t.strokes.length,1,'dissolve motes have their remaining reference lifetime');
t.step(.89);assert.equal(t.strokes.length,1);t.step(.02);assert.equal(t.strokes.length,0,'finished dissolve expires and frees history');
t.down(300,600,30000);assert.equal(t.active.points[0].x,300,'new stroke does not bridge to the previous one');
t.release();const oldRoute=t.getRoute(t.strokes[0]);t.resize(780,1688);
assert.equal(t.strokes[0].points[0].x,600);assert.equal(t.strokes[0].points[0].y,1200);assert.deepEqual(t.strokes[0].rawTip,{x:600,y:1200});
assert.equal(t.layer,layer,'resize reuses its layer object');assert.ok(layer.width<=2400&&layer.height<=2400,'large viewports bound backing-store memory');
assert.notEqual(t.getRoute(t.strokes[0]),oldRoute,'resize invalidates curve caches');
t.reset();assert.equal(t.strokes.length,0);assert.equal(t.active,null);assert.equal(t.time,0);

const off=make({trailEnabled:false});off.down(50,50,0);off.move(60,60,16);
assert.equal(off.strokes.length,0,'disabled trails accept no drawing history');assert.equal(paint(off).composites.length,0,'disabled trails paint no layer');
const single=make({trailRandom:true,trailBlue:false,trailPurple:false,trailWhite:true});
for(let i=0;i<30;i++){single.down(i,100,i*16);assert.equal(single.active.color,'#ffffff');single.release();}
const mixed=make({trailRandom:true}),colors=new Set();
for(let i=0;i<30;i++){mixed.down(i,100,i*16);colors.add(mixed.active.color);mixed.release();}assert.equal(colors.size,3,'enabled random colors remain reachable');
const custom=make({...EffectSettings.defaults,trailPalette:['#abcdef','#123456'],trailRandom:false});custom.down(40,40,0);assert.equal(custom.active.color,'#abcdef','fixed color uses the first palette swatch');
const legacy=new FingerTrails({trailColor1:'#123456',trailRandom:false},create);legacy.resize(390,844);legacy.down(40,40,0);
assert.equal(legacy.active.color,'#123456','raw legacy callers migrate before the renderer selects a color');
const palette=['#ff6633','#99cc22','#3366ff','#cc33ff','#fefefe'],expanded=make({trailPalette:palette,trailRandom:true}),expandedColors=new Set();
for(let i=0;i<50;i++){
  expanded.down(i,100,i*16);const color=expanded.active.color;expandedColors.add(color);
  expanded.move(i+20,120,i*16+8);expanded.step(.02);
  assert.equal(expanded.active.color,color,'a stroke keeps its selected color through movement and animation');expanded.release();
}
assert.deepEqual([...expandedColors].sort(),palette.slice().sort(),'all custom swatches beyond the old three-color limit are reachable');
const dim=make({trailOpacity:40});drawLine(dim);close(paint(dim).composites[0].alpha,.4,'configured opacity reaches final composition');

// Pointer smoothing and sampled geometry must match the selected preview.
const curved=make({});curved.down(0,0,0);curved.move(100,0,16);curved.move(100,100,32);
close(curved.active.points[1].x,90,'preview filtering gain is applied');close(curved.active.points[2].x,99,'filter carries through a turn');close(curved.active.points[2].y,90,'filter follows the second segment');
const ref=new MagicTrailReference(),referenceStroke={points:curved.active.points.map(p=>({...p})),route:null};
const curve=curved.getRoute(curved.active);assert.deepEqual(curve,ref.route(referenceStroke),'normal paths use the exact approved quadratic curve and normals');
assert.ok(curve.points.every(p=>p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100),'smoothing stays within the intended corner');
assert.equal(curved.getRoute(curved.active),curve,'unchanged geometry is cached');
const fixedGeometry=JSON.stringify(curve);curved.step(.4);paint(curved);assert.equal(JSON.stringify(curve),fixedGeometry,'light animation never deforms the underlying drawing');
curved.move(150,100,48);assert.notEqual(curved.getRoute(curved.active),curve,'new input invalidates geometry');
for(const p of routePoints(curved,curved.active))for(const key of ['x','y','d','nx','ny','speed'])assert.ok(Number.isFinite(p[key]),'finite sampled '+key);

// Controls are checked through rendered commands, rather than source assertions.
const normal=make({}),wide=make({trailWidth:5});drawLine(normal);drawLine(wide);
const widths=tr=>paint(tr).commands.filter(c=>c.name==='stroke').map(c=>c.width);
assert.ok(Math.max(...widths(wide))>Math.max(...widths(normal)),'width control changes the actual band');
const withDust=make({}),withoutDust=make({trailDustEnabled:false});for(const tr of [withDust,withoutDust]){drawLine(tr);tr.step(.5);}
assert.ok(paint(withDust).commands.length>paint(withoutDust).commands.length,'dust toggle removes procedural motes');
const noFlow=make({trailFlowEnabled:false});drawLine(noFlow);noFlow.step(.5);assert.ok(paint(withDust).commands.length>paint(noFlow).commands.length,'flow toggle removes moving energy details');
const slow=make({trailFlowSpeed:100}),fast=make({trailFlowSpeed:200});for(const tr of [slow,fast]){drawLine(tr);tr.step(.5);}
assert.notDeepEqual(paint(slow).commands,paint(fast).commands,'flow speed changes rendered positions at the same time');
const noDust=make({trailDustDensity:0});drawLine(noDust);noDust.step(.5);assert.deepEqual(paint(noDust).commands,paint(withoutDust).commands,'zero dust density disables ordinary motes and fine flashes');
const longer=make({trailHold:5,trailFade:3});const longStroke=drawLine(longer);longer.release();longer.step(5);assert.equal(longer.opacity(longStroke),1);
longer.step(1.5);close(longer.opacity(longStroke),.5,'custom fade duration reaches the lifecycle');longer.step(3.31);assert.equal(longer.strokes.length,0,'custom dissolve has a finite lifetime');

const crowded=make({});
for(let s=0;s<25;s++){
  crowded.down(0,100,s*100000);for(let i=1;i<1600;i++)crowded.move(i%390,100+Math.sin(i/10)*80,s*100000+i*16);crowded.release();
  assert.ok(crowded.strokes.length<=16,'stroke history is bounded');assert.ok(crowded.strokes.every(s=>s.points.length<=900),'each stroke has a bounded input history');
  assert.ok(crowded.strokes.reduce((n,s)=>n+s.points.length,0)<=8192,'combined input history is bounded');
}
const last=crowded.strokes.at(-1);assert.equal(last.points[0].x,0,'history simplification retains the beginning');
assert.deepEqual(last.rawTip,{x:1599%390,y:100+Math.sin(1599/10)*80},'history simplification retains final raw input');
paint(crowded);const geometries=crowded.strokes.map(s=>routePoints(crowded,s));
assert.ok(geometries.every(p=>p.length<=4096),'a long stroke has a finite geometric budget');assert.ok(geometries.reduce((n,p)=>n+p.length,0)<=8192,'many long strokes share a global geometry budget');
close(paint(crowded).composites[0].alpha,.86,'overlap never increases final layer opacity');
const jump=make({});jump.down(0,400,0);jump.move(100000,400,16);paint(jump);
assert.ok(routePoints(jump,jump.active).length<=4096,'single pointer jump cannot allocate an unbounded mesh');
assert.ok(paint(jump).commands.length<40000,'huge jump cannot emit unbounded decoration');
crowded.reset();assert.equal(crowded.strokes.length,0);assert.equal(crowded.active,null);
console.log('Ribbon behavior checks passed: approved geometry, bounded composition/history, smoothing, lifecycle, controls, colors and resize.');
