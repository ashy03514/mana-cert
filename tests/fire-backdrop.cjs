'use strict';
// Actual Canvas draws plus the shared reveal clock. Phone appearance is a separate check.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/element-reveal-backdrop.js');
require('../js/reveal-flow.js');
const backdrop=new ElementRevealBackdrop(()=>createCanvas(1,1));
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
function advance(flow,seconds){
  let remaining=seconds;
  while(remaining>1e-9){const dt=Math.min(.05,remaining);flow.step(dt);remaining-=dt;}
}
function frame(time,{element='fire',opacity=1,width=390,height=844,firePower}={}){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.fillStyle='#080915';ctx.fillRect(0,0,width,height);
  const before=Buffer.from(ctx.getImageData(0,0,width,height).data);
  ctx.globalAlpha=.57;ctx.globalCompositeOperation='screen';ctx.translate(2,3);
  const matrix=ctx.getTransform(),alpha=ctx.globalAlpha;
  const config={element,time,opacity,firePower,focus:{x:width*.18,y:height*.26,width:width*.64,height:height*.48}};
  const input=JSON.stringify(config);
  const painted=backdrop.draw(ctx,width,height,config);
  close(ctx.globalAlpha,alpha,'Canvas opacity restored');
  assert.equal(ctx.globalCompositeOperation,'screen','Canvas blend restored');
  assert.deepEqual(ctx.getTransform(),matrix,'Canvas transform restored');
  assert.equal(JSON.stringify(config),input,'drawing does not mutate material frame');
  const pixels=Buffer.from(ctx.getImageData(0,0,width,height).data);
  // napi Canvas reports the last assigned gradient through its getter even
  // after restore; verify the restored paint by its actual rendered pixel.
  ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';
  ctx.fillRect(0,0,1,1);
  assert.deepEqual([...ctx.getImageData(0,0,1,1).data],[8,9,21,255],'Canvas paint restored');ctx.restore();
  return {painted,pixels,before,canvas};
}

for(const element of ['wind','earth','light','dark',null]){
  const result=frame(2.7,{element});
  assert.equal(result.painted,false,`${element}: no fire backdrop`);
  assert.ok(result.before.equals(result.pixels),`${element}: original scene preserved`);
}
const transparent=frame(2.7,{opacity:0});
assert.equal(transparent.painted,false,'fully faded fire does not draw');
assert.ok(transparent.before.equals(transparent.pixels));

for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
  for(const time of [0,.1,.5,1,1.5,1.99,2,2.5,9.25,1000.75]){
    const first=frame(time,{width,height});
    assert.equal(first.painted,time>0,'backdrop transitions in from the original scene at ignition');
    // Rendering another time first must not change a paused frame or replay.
    frame(time+.73,{width,height});
    assert.ok(first.pixels.equals(frame(time,{width,height}).pixels),'same clock gives exactly the same frame');
  }
}
assert.ok(!frame(2.2).pixels.equals(frame(2.9).pixels),'energy visibly travels with time');
const emberBackdrop=frame(2.8,{firePower:0}),strongBackdrop=frame(2.8,{firePower:1});
const perimeterRed=pixels=>{let sum=0;for(let y=0;y<844;y++)for(let x=0;x<45;x++)sum+=pixels[(y*390+x)*4];return sum;};
assert.ok(perimeterRed(strongBackdrop.pixels)>perimeterRed(emberBackdrop.pixels)*1.2,
  'the perimeter energy grows with fuel while using the same pulse position');
assert.ok(emberBackdrop.pixels.equals(frame(2.8,{firePower:0}).pixels),'a paused fuel sample is deterministic');

// A pulse crosses the entire viewport, then a new pulse launches every 2 s.
for(const [width,height] of [[390,844],[844,390]]){
  const launch=ElementRevealBackdrop.sample(0,width,height);
  const end=ElementRevealBackdrop.sample(1.65,width,height);
  assert.equal(launch.cycle,0);assert.equal(launch.phase,0);
  assert.equal(launch.alpha,0,'new pulse is invisible below the screen');
  assert.ok(launch.y>height,'energy launches below the viewport');
  assert.ok(end.y<0,'energy reaches above the viewport');
  let lastY=launch.y;
  for(let i=1;i<=33;i++){
    const sample=ElementRevealBackdrop.sample(i*.05,width,height);
    assert.ok(sample.y<lastY,'pulse continuously rises until it leaves the top');
    assert.ok(sample.alpha>=0&&sample.alpha<=1,'bounded pulse alpha');
    lastY=sample.y;
  }
  for(const time of [.125,.5,.875,1.25,1.875]){
    const first=ElementRevealBackdrop.sample(time,width,height);
    const repeated=ElementRevealBackdrop.sample(time+2,width,height);
    assert.equal(repeated.cycle,first.cycle+1,'exactly one new wave every 2 seconds');
    for(const key of ['phase','front','y','alpha'])close(repeated[key],first[key],key+' repeats with 2-second cadence');
  }
}

const flow=new RevealFlow({}, {holdAtReveal:true});
flow.reset('fire');flow.down(1,10,10);flow.move(1,60,60);flow.up(1);
assert.equal(flow.materialFrame,null,'drawing and gather have no attribute backdrop clock');
advance(flow,1.7+flow.gatherDuration);
assert.equal(flow.state,'FORM');close(flow.materialFrame.time,0,'backdrop begins with ignition');
advance(flow,flow.formationDuration-.01);
const beforeBoundary=flow.materialFrame.time;
advance(flow,.02);
assert.equal(flow.state,'REVEAL');
close(flow.materialFrame.time-beforeBoundary,.02,'energy clock continuous through FORM to REVEAL');
advance(flow,3.25);
const pauseTime=flow.materialFrame.time,pausedPixels=frame(pauseTime).pixels;
flow.paused=true;advance(flow,20);
close(flow.materialFrame.time,pauseTime,'pause preserves energy phase');
assert.ok(pausedPixels.equals(frame(flow.materialFrame.time).pixels),'paused backdrop stays pixel-identical');
flow.paused=false;advance(flow,20);
assert.equal(flow.state,'REVEAL','formal animation remains live in attribute reveal');
close(flow.materialFrame.time,pauseTime+20,'formal energy continues to run');
flow.reset('fire');flow.down(1,10,10);flow.move(1,60,60);flow.up(1);advance(flow,1.7+flow.gatherDuration);
close(flow.materialFrame.time,0,'replay resets energy clock');
assert.ok(frame(0).pixels.equals(frame(flow.materialFrame.time).pixels),'replay has the same initial energy state');

const html=read('index.html'),sw=read('service-worker.js');
const asset='./js/element-reveal-backdrop.js';
assert.ok(html.includes(`<script src="${asset}"></script>`),'production HTML loads shared backdrop');
assert.ok(sw.includes(`"${asset}"`),'offline PWA caches backdrop');
const host=html.slice(html.indexOf('function drawRevealFlow(){'),html.indexOf('function openFlowPreview('));
assert.ok(host.includes('elementBackdrop.draw'),'formal and flow preview use shared backdrop');
const materialDraw=host.indexOf('drawPreviewMaterial(w,h');
assert.ok(materialDraw>=0&&host.indexOf('elementBackdrop.draw')<materialDraw,'fire material dispatch stays on top of its background');
const dispatch=html.slice(html.indexOf('function activeMaterialRenderer(){'),html.indexOf('function updateMaterialError(){'));
assert.match(dispatch,/return usesOceanPreview\(\)\?[^;]+:materialRenderer;/,'fire still selects its existing material renderer');
assert.match(dispatch,/return active\.draw\(ctx,canvas,w,h,frame\);/,'fire dispatch paints the active material frame');
assert.match(host,/elementBackdrop\.draw\([^;]+time:waterEffects\?\.time\?\?frame\.time/,'fire retains the material clock when the water clock is absent');
console.log('Fire backdrop Canvas, lifecycle and offline wiring checks passed.');
