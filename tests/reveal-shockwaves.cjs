'use strict';
// Temporal behavior and real Canvas pixels; device appearance is a separate check.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/reveal-shockwaves.js');
require('../js/reveal-flow.js');
const sample=(state,elapsed,width=390,height=844)=>RevealShockwaves.sample({state,elapsed,width,height});
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} vs ${expected}`);
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
function advance(flow,seconds){
  let left=seconds;
  while(left>1e-9){const dt=Math.min(.05,left);flow.step(dt);left-=dt;}
}

for(const state of ['DRAWING','FORM','REVEAL','SETTLE','DONE']){
  for(const elapsed of [0,.25,.6,1,20])assert.equal(sample(state,elapsed),null,`${state} has no shockwave`);
}
assert.equal(sample('WAITING',.479999),null,'the initial drawing hold has no shockwave');
assert.equal(sample('WAITING',.48).id,1,'first wave starts at .48 s');
assert.equal(sample('WAITING',.839999).id,1,'first wave completes before second');
assert.equal(sample('WAITING',.84).id,2,'second wave starts immediately after first ends');
assert.equal(sample('WAITING',1.199999).id,2,'second wave lasts until the post-wave hold');
assert.equal(sample('WAITING',1.2),null,'inward waves finish before the half-second hold');
for(const elapsed of [1.2,1.25,1.5,1.699999]){
  assert.equal(sample('WAITING',elapsed),null,'the half-second post-wave hold contains no shockwave');
}
assert.equal(sample('GATHER',0).id,3,'outward wave begins exactly with explosion');
assert.equal(sample('GATHER',.419999).id,3,'outward wave lasts .42 s');
assert.equal(sample('GATHER',.42),null,'outward wave ends cleanly');
assert.equal(sample('GATHER',2),null,'there is no extra wave during later gathering');

for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
  for(const [id,state,start,duration,direction] of [[1,'WAITING',.48,.36,'in'],[2,'WAITING',.84,.36,'in'],[3,'GATHER',0,.42,'out']]){
    let previous;
    for(let i=0;i<36;i++){
      const elapsed=start+duration*i/36;
      const frame=sample(state,elapsed,width,height);
      assert.equal(frame.id,id);assert.equal(frame.direction,direction);
      close(frame.progress,i/36,'wave uses the active state clock');
      close(frame.x,width/2,'wave center x');close(frame.y,height/2,'wave center y');
      assert.ok(Number.isFinite(frame.radius)&&frame.radius>=0,'finite nonnegative radius');
      assert.ok(frame.alpha>=0&&frame.alpha<=1,'bounded opacity');
      if(previous)assert.ok(direction==='in'?frame.radius<previous.radius:frame.radius>previous.radius,`${direction} radius changes continuously`);
      assert.deepEqual(sample(state,elapsed,width,height),frame,'sampling a paused clock is deterministic');
      previous=frame;
    }
  }
}
// At every point in the full sequence, only one wave is active. No ring overlap
// or early outward pulse can slip through at a frame-rate-dependent boundary.
for(let i=0;i<1700;i++){
  const elapsed=i/1000,frame=sample('WAITING',elapsed);
  assert.equal(frame?.id??null,elapsed<.48?null:elapsed<.84?1:elapsed<1.2?2:null);
}

function draw(state,elapsed,width=390,height=844){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.globalAlpha=.73;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#203040';ctx.strokeStyle='#507090';ctx.lineWidth=7;
  const alpha=ctx.globalAlpha,matrix=ctx.getTransform();
  const input={state,elapsed,width,height},before=JSON.stringify(input);
  RevealShockwaves.draw(ctx,input);
  close(ctx.globalAlpha,alpha,'drawing restores Canvas alpha');
  assert.equal(ctx.globalCompositeOperation,'source-over','drawing restores Canvas compositing');
  assert.equal(ctx.lineWidth,7,'drawing restores stroke width');
  assert.deepEqual(ctx.getTransform(),matrix,'drawing restores transform');
  assert.equal(JSON.stringify(input),before,'drawing does not mutate its frame');
  const pixels=Buffer.from(ctx.getImageData(0,0,width,height).data);
  // Verify actual restored paint; native Canvas gradient getters can retain
  // their last assigned object even after the drawing state has been restored.
  ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';
  ctx.fillRect(0,0,1,1);
  assert.deepEqual([...ctx.getImageData(0,0,1,1).data],[32,48,64,255],'drawing restores fill paint');
  ctx.restore();
  return pixels;
}
for(const [state,time] of [['WAITING',.65],['WAITING',1.01],['GATHER',.2]]){
  const pixels=draw(state,time),opaque=[];
  let cyan=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>3){
    opaque.push(i/4);
    if(pixels[i+2]>=pixels[i]&&pixels[i+1]>=pixels[i])cyan++;
  }
  assert.ok(opaque.length>100,'each wave produces visibly nontransparent pixels');
  assert.ok(cyan/opaque.length>.9,'visible shockwave pixels use pale blue');
  draw('GATHER',.27);
  assert.ok(pixels.equals(draw(state,time)),'paused/replayed Canvas frame is pixel-identical');
}
for(const [state,time] of [['DRAWING',.7],['WAITING',.3],['WAITING',1.2],['WAITING',1.5],['WAITING',1.699999],['GATHER',.8],['FORM',.1]]){
  assert.ok(draw(state,time).every(value=>value===0),'inactive waves do not paint over the scene');
}
// A portrait viewport must not stretch the circular effect to match its aspect.
const circleWidth=640,circleHeight=900;
let circleTime;
for(let t=.49;t<.84;t+=.005){
  const radius=sample('WAITING',t,circleWidth,circleHeight).radius;
  if(radius>65&&radius<110){circleTime=t;break;}
}
assert.ok(circleTime!==undefined,'inward wave crosses a visible intermediate radius');
const circle=draw('WAITING',circleTime,circleWidth,circleHeight);
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
for(let y=0;y<circleHeight;y++)for(let x=0;x<circleWidth;x++){
  if(circle[(y*circleWidth+x)*4+3]<8)continue;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
}
assert.ok(Math.abs((maxX-minX)-(maxY-minY))<12,'visible ring stays circular in CSS pixels');
assert.ok(Math.abs((minX+maxX)/2-circleWidth/2)<6,'ring remains horizontally centered');
assert.ok(Math.abs((minY+maxY)/2-circleHeight/2)<6,'ring remains vertically centered');

// A real radial alpha cross-section catches the former bright 1 px outline.
// Airbrushed density should occupy a broad band, with no abrupt bright ridge.
for(const [width,height] of [[390,844],[640,900]]){
  const scale=Math.max(.65,Math.min(1.8,Math.min(width,height)/390));
  for(const [state,start,end] of [['WAITING',.49,.84],['WAITING',.85,1.2],['GATHER',.01,.42]]){
    let elapsed;
    for(let t=start;t<end;t+=.001){
      const wave=sample(state,t,width,height);
      if(wave.radius>100*scale&&wave.radius<110*scale&&wave.alpha>.7){elapsed=t;break;}
    }
    assert.ok(elapsed!==undefined,'each pressure front crosses an inspectable radius at visible opacity');
    const pixels=draw(state,elapsed,width,height),cx=width/2,cy=height/2;
    for(const direction of [-1,1]){
      const profile=[];
      for(let distance=0;distance<width/2-1;distance++){
        const x=Math.floor(cx+direction*distance),y=Math.floor(cy);
        profile.push(pixels[(y*width+x)*4+3]);
      }
      const peak=Math.max(...profile);
      assert.ok(peak>=20,'softening preserves a visible blue pressure front');
      const aboveHalf=profile.filter(alpha=>alpha>=peak/2).length;
      const maxJump=Math.max(...profile.slice(1).map((alpha,index)=>Math.abs(alpha-profile[index])));
      assert.ok(aboveHalf>=12*scale,`${state} radial half-peak width ${aboveHalf} must be a soft band, not a thin outline`);
      assert.ok(maxJump<=peak*.15+2,`${state} alpha step ${maxJump} at peak ${peak} must not create a sharp line`);
    }
  }
}

for(const element of ['fire','water','wind','earth','light','dark',null]){
  for(const burstDuration of [1.2,2.1,4]){
    const flow=new RevealFlow({burstDuration},{holdAtReveal:true});
    flow.reset(element);flow.down(1,10,10);flow.move(1,80,60);flow.up(1);
    advance(flow,.65);
    assert.equal(sample(flow.state,flow.elapsed).id,1);
    const paused=sample(flow.state,flow.elapsed);
    flow.paused=true;advance(flow,5);
    assert.deepEqual(sample(flow.state,flow.elapsed),paused,'flow pause freezes the ring clock');
    flow.paused=false;advance(flow,.36);
    assert.equal(sample(flow.state,flow.elapsed).id,2);
    advance(flow,.19);
    assert.equal(flow.state,'WAITING','second wave completion enters the hold instead of exploding');
    close(flow.elapsed,1.2,'second wave completes at the same original time');
    assert.equal(sample(flow.state,flow.elapsed),null,'the half-second hold starts without a third wave');
    const heldState=JSON.stringify(flow);
    flow.paused=true;advance(flow,5);
    assert.equal(JSON.stringify({...flow,paused:false}),heldState,'pause also freezes the entire post-wave hold');
    flow.paused=false;advance(flow,.49);
    assert.equal(flow.state,'WAITING','a full half-second hold remains before explosion');
    assert.equal(sample(flow.state,flow.elapsed),null,'no shockwave appears during the hold');
    assert.equal(flow.materialFrame,null,'hold does not reveal the element prematurely');
    advance(flow,.01);
    assert.equal(flow.state,'GATHER','explosion starts exactly half a second after the second wave');
    close(flow.elapsed,0,'explosion receives a fresh animation clock');
    assert.equal(sample(flow.state,flow.elapsed).id,3,'third wave shares the explosion clock');
    advance(flow,.43);
    assert.equal(sample(flow.state,flow.elapsed),null,'shockwave does not alter the later gather duration');
  }
}
const resume=new RevealFlow();resume.down(1,0,0);resume.move(1,50,40);resume.up(1);advance(resume,.65);
assert.equal(sample(resume.state,resume.elapsed).id,1);
assert.equal(resume.down(2,70,40),true,'drawing can resume during the first wave');
assert.equal(sample(resume.state,resume.elapsed),null,'continuing the drawing immediately cancels the pending ring');
resume.move(2,100,40);resume.up(2);advance(resume,.49);
assert.equal(sample(resume.state,resume.elapsed).id,1,'release after continuing restarts the wave sequence');

for(const holdTime of [1.2,1.45,1.69]){
  const continued=new RevealFlow();continued.down(1,0,0);continued.move(1,50,40);continued.up(1);advance(continued,holdTime);
  assert.equal(continued.state,'WAITING');
  // Summed frame times can be a fraction of an ulp below exactly 1.2 s;
  // the previous front must already be completely invisible there.
  assert.equal(sample(continued.state,continued.elapsed)?.alpha??0,0);
  assert.equal(continued.down(2,70,40),true,'the post-wave hold still accepts continued drawing');
  advance(continued,5);assert.equal(continued.state,'DRAWING','continuing during the hold cancels the scheduled explosion');
  continued.move(2,100,40);continued.up(2);advance(continued,.49);
  assert.equal(sample(continued.state,continued.elapsed).id,1,'release after the hold restarts from the first wave');
  advance(continued,1.01);continued.paused=true;continued.cancelPointer();
  assert.equal(continued.state,'DRAWING','lifecycle cancellation clears the hold even while paused');
  continued.paused=false;advance(continued,5);
  assert.equal(continued.state,'DRAWING','cancelled hold cannot trigger a delayed explosion');
}

const html=read('index.html'),sw=read('service-worker.js'),asset='./js/reveal-shockwaves.js';
assert.ok(html.includes(`<script src="${asset}"></script>`),'production HTML loads the shared effect');
assert.ok(sw.includes(`"${asset}"`),'offline PWA caches the effect');
const host=html.slice(html.indexOf('function drawRevealFlow(){'),html.indexOf('function openFlowPreview('));
const drawAt=host.indexOf('RevealShockwaves.draw');
assert.ok(drawAt>=0,'formal and preview share the same wave draw path');
assert.ok(drawAt>host.indexOf('flowPortal.draw')&&drawAt>host.indexOf('gather.draw'),'shockwaves draw over the atmosphere and explosion');
assert.match(host,/RevealShockwaves\.draw\([^;]+elapsed:flow\.elapsed/,'host uses the shared pause-aware state clock');
assert.match(host,/RevealShockwaves\.draw\([^;]+state/,'host passes the current flow state');
console.log('Soft shockwave radial pixels, two inward waves, half-second hold, outward explosion, lifecycle and offline wiring checks passed.');
