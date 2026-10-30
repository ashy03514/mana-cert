'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/ribbon-renderer.js');
require('../js/reveal-gather.js');

const WIDTH=390,HEIGHT=844,DURATION=2.1,target={x:WIDTH/2,y:HEIGHT/2};
const points=Array.from({length:140},(_,i)=>({
  x:195+Math.sin(i*.15)*135,y:422+Math.cos(i*.11)*240,speed:.4
}));
function input(source=points,settings={}){
  return {width:WIDTH,height:HEIGHT,time:12,
    settings:{trailEnabled:true,trailOpacity:100,...settings},
    renderer:new RibbonRenderer({color:'#7deaff',width:1,glowSize:1}),
    strokes:[{seed:7,color:'#7deaff',released:11.8,points:source.map(p=>({...p}))}],
    opacity(){return 1;}};
}
function finiteFrame(frame){
  for(const key of ['x','y','radius','angle','alpha']){
    assert.ok(Number.isFinite(frame[key]),`flash ${key} must remain finite`);
  }
  assert.ok(frame.radius>0,'flash radius stays positive');
  assert.ok(frame.alpha>=0&&frame.alpha<=1,'flash opacity stays bounded');
  assert.equal(frame.angle,0,'sharp flashes never rotate');
  assert.ok(frame.color.every(n=>Number.isFinite(n)&&n>=0&&n<=255));
}
function peakOf(gather,flash){
  let peak={alpha:-1};
  for(let i=0;i<=120;i++){
    const progress=flash.start+flash.life*i/120;
    const frame=gather.flashFrame(flash,progress);
    finiteFrame(frame);
    if(frame.alpha>peak.alpha)peak={...frame,progress};
  }
  return peak;
}
function render(gather,frame={},full=false){
  const canvas=createCanvas(Math.max(1,gather.width),Math.max(1,gather.height));
  const ctx=canvas.getContext('2d');
  ctx.globalAlpha=.73;ctx.fillStyle='#123456';ctx.globalCompositeOperation='source-over';
  const state=[ctx.globalAlpha,ctx.globalCompositeOperation];
  ctx.fillRect(0,0,1,1);
  const callerPaint=Buffer.from(ctx.getImageData(0,0,1,1).data);
  ctx.clearRect(0,0,1,1);
  gather[full?'draw':'drawFlashes'](ctx,{target,...frame});
  assert.deepEqual([ctx.globalAlpha,ctx.globalCompositeOperation],state,
    'flash drawing restores the caller canvas state');
  const pixels=Buffer.from(ctx.getImageData(0,0,canvas.width,canvas.height).data);
  ctx.clearRect(0,0,1,1);ctx.fillRect(0,0,1,1);
  assert.deepEqual(Buffer.from(ctx.getImageData(0,0,1,1).data),callerPaint,
    'flash drawing restores the caller paint color');
  return pixels;
}
function litPixels(pixels,threshold=0){
  let count=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>threshold)count++;
  return count;
}
function strongestAlpha(pixels,x,y,reach=1){
  let strongest=0;
  for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
    const px=Math.round(x)+dx,py=Math.round(y)+dy;
    if(px>=0&&px<WIDTH&&py>=0&&py<HEIGHT){
      strongest=Math.max(strongest,pixels[(py*WIDTH+px)*4+3]);
    }
  }
  return strongest;
}

const random=Math.random;
Math.random=()=>{throw Error('impact flashes must not consume result randomness');};
try{
  const source=input(),gather=new RevealGather();
  gather.capture(source,WIDTH,HEIGHT);
  assert.equal(gather.flashes.length,30,
    'a full drawing has 50 percent more sharp flashes, bounded at 30');
  // Seeded sizes from the previous 20-flash fixture, before the requested 20%
  // enlargement. A fixed baseline catches scaling the glow but not the arms.
  const previousSizes=[31.837769829552318,20.64134946564086,10.069889050231534,
    17.508636600541973,15.731405332192931,10.962753460041712,10.00160475026375,
    13.5352323035337,16.64200128730057,25.367476530335658,21.311511275197066,
    31.100624565529774,23.509494226459694,26.270717503892214,12.866539825699798,
    16.517330214321184,10.033950202558541,15.37536616204183,17.2156297088154,
    15.289736696294995];
  previousSizes.forEach((size,i)=>assert.ok(
    Math.abs(gather.flashFrame(gather.flashes[i],.3).radius-size*1.2)<1e-9,
    'each original sharp flash is exactly 20 percent larger at the phone baseline'));
  assert.ok(Object.isFrozen(gather.flashes),'flash pool is immutable');
  for(const flash of gather.flashes){
    assert.ok(Object.isFrozen(flash)&&Object.isFrozen(flash.color),
      'flash parameters and colors are immutable');
    assert.ok(flash.life*DURATION>=.09-1e-6&&flash.life*DURATION<=.18+1e-6,
      'a sharp flash lasts only 90 to 180 milliseconds');
    assert.ok(flash.start>0&&flash.start+flash.life<.8,
      'sharp flashes belong to the outward explosion, before final gathering');
  }
  assert.throws(()=>{gather.flashes[0].life=1;},TypeError);
  const snapshot=JSON.stringify(gather.flashes),starSnapshot=JSON.stringify(gather.stars);
  source.strokes[0].points[0].x=-10000;source.settings.flashPalette=['#ff0000'];
  assert.equal(JSON.stringify(gather.flashes),snapshot,
    'editing live input cannot move a captured impact flash');

  const peaks=[];
  for(const flash of gather.flashes){
    const visible=[];
    for(let i=1;i<100;i++){
      const frame=gather.flashFrame(flash,flash.start+flash.life*i/100);
      finiteFrame(frame);
      if(frame.alpha>.02)visible.push(frame);
    }
    assert.ok(visible.length>20,'the short flash still has a visible pulse');
    const reference=visible[0];
    for(const frame of visible){
      assert.deepEqual([frame.x,frame.y,frame.radius,frame.angle],
        [reference.x,reference.y,reference.radius,0],
        'an impact flash stays fixed in place, size and orientation through its life');
    }
    assert.ok(Math.max(...visible.map(f=>f.alpha))-Math.min(...visible.map(f=>f.alpha))>.5,
      'each fixed flash changes brightness rapidly');
    for(const progress of [flash.start-.001,flash.start,flash.start+flash.life,
      flash.start+flash.life+.001,1]){
      assert.equal(gather.flashFrame(flash,progress).alpha,0,
        'a flash has no lingering light outside its short lifetime');
    }
    peaks.push(peakOf(gather,flash));
  }
  const span=key=>Math.max(...peaks.map(p=>p[key]))-Math.min(...peaks.map(p=>p[key]));
  assert.ok(span('progress')>.15,'sharp flashes occur in staggered bursts');
  assert.ok(Math.max(...peaks.map(p=>p.radius))>Math.min(...peaks.map(p=>p.radius))*1.6,
    'sharp flashes have a clear large and small size range');
  assert.ok(span('x')>WIDTH*.75&&span('y')>HEIGHT*.8,
    'flashes span the phone width and height rather than just the orbit ring');
  for(const p of peaks){
    assert.ok(p.x>0&&p.x<WIDTH&&p.y>0&&p.y<HEIGHT,
      'each flash centre appears inside the viewport');
  }
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
    assert.ok(peaks.some(p=>Math.floor(p.x/WIDTH*3)===column&&Math.floor(p.y/HEIGHT*3)===row),
      `flashes reach viewport sector ${column},${row}, including its middle and corners`);
  }
  assert.ok(peaks.some(p=>Math.abs(p.x/WIDTH-.5)<.1&&Math.abs(p.y/HEIGHT-.5)<.15),
    'sharp flashes also occupy the previously empty central opening');

  // Isolate a real seeded flash to inspect the actual rasterized silhouette.
  // Four bright needle-like arms should stand out from their dark diagonals;
  // this catches an accidental diamond, round glow or thick plus-sign shape.
  const candidate=peaks.map((p,i)=>({p,flash:gather.flashes[i]})).filter(({p})=>
    p.x>p.radius*1.5&&p.x<WIDTH-p.radius*1.5&&
    p.y>p.radius*1.5&&p.y<HEIGHT-p.radius*1.5).sort((a,b)=>b.p.radius-a.p.radius)[0];
  assert.ok(candidate,'at least one large flash must fit fully within the phone viewport');
  const isolated=new RevealGather();isolated.resize(WIDTH,HEIGHT);
  isolated.flashes=Object.freeze([candidate.flash]);
  const p=candidate.p,pixels=render(isolated,{progress:p.progress});
  assert.ok(strongestAlpha(pixels,p.x,p.y)>190,'the momentary flash has a strong bright core');
  const distance=p.radius*.43;
  const axes=[[distance,0],[-distance,0],[0,distance],[0,-distance]];
  const diagonals=[[distance,distance],[-distance,distance],[distance,-distance],[-distance,-distance]];
  const armAlpha=Math.min(...axes.map(([x,y])=>strongestAlpha(pixels,p.x+x,p.y+y)));
  const diagonalAlpha=Math.max(...diagonals.map(([x,y])=>strongestAlpha(pixels,p.x+x,p.y+y)));
  assert.ok(armAlpha>35,'all four fine arms extend visibly away from the bright core');
  assert.ok(diagonalAlpha<armAlpha*.4,
    'long sharp arms remain clearly separated by dark concave diagonals');
  assert.ok(litPixels(pixels,128)<Math.PI*p.radius*p.radius*.23,
    'high-intensity light stays concentrated into thin arms instead of a filled blob');

  const still=render(gather,{progress:p.progress,time:1,element:'fire'});
  assert.ok(litPixels(still,128)>12,'the complete flash layer produces readable strong light');
  render(gather,{progress:.65,time:11,element:'dark'});
  assert.deepEqual(render(gather,{progress:p.progress,time:99,element:'water'}),still,
    'paused flashes preserve exact pixels regardless of wall time or render order');
  for(const progress of [0,.8,.9,1,2]){
    assert.equal(litPixels(render(gather,{progress})),0,
      'sharp flashes disappear completely before the last inward gathering');
  }
  for(const formation of [.001,.1,.5,1]){
    assert.equal(litPixels(render(gather,{progress:p.progress,formation})),0,
      'material formation does not retain impact flashes');
  }
  const combined=render(gather,{progress:p.progress},true),drawFlashes=gather.drawFlashes;
  gather.drawFlashes=()=>{};
  assert.notDeepEqual(render(gather,{progress:p.progress},true),combined,
    'production gather rendering includes the sharp flash layer');
  gather.drawFlashes=drawFlashes;
  assert.equal(JSON.stringify(gather.flashes),snapshot,'drawing never mutates flash seeds');
  assert.equal(JSON.stringify(gather.stars),starSnapshot,'the existing rotating stars remain unchanged');

  for(const size of [[780,1688],[844,390],[1,1],[390,844],[NaN,844],[-1,0]]){
    const previous=[gather.width,gather.height];
    gather.resize(...size);
    if(size.some(n=>!Number.isFinite(n)||n<=0))assert.deepEqual([gather.width,gather.height],previous);
    for(const progress of [-1,NaN,Infinity,.25,.55,.9,1]){
      for(const flash of gather.flashes)finiteFrame(gather.flashFrame(flash,progress));
      render(gather,{progress});
    }
  }
  assert.equal(JSON.stringify(gather.flashes),snapshot,'resize changes only projection, not the captured flash plan');

  const busy=input(Array.from({length:1200},(_,i)=>({x:i%2?380:10,y:20+i*79%804})));
  busy.strokes=Array.from({length:32},(_,seed)=>({...busy.strokes[0],seed}));
  const bounded=new RevealGather();bounded.capture(busy,WIDTH,HEIGHT);
  assert.equal(bounded.flashes.length,30,'very long drawings cannot grow the flash pool beyond 30');
  const replay=new RevealGather(),replaySource=input(points,{starEnabled:false});
  replay.capture(replaySource,WIDTH,HEIGHT);
  assert.ok(replay.flashes.length>0,'event flashes are independent of ambient star visibility');
  const replaySnapshot=JSON.stringify(replay.flashes);
  replay.capture(null,WIDTH,HEIGHT);
  assert.equal(replay.flashes.length,0,'replay clears the previous flash pool');
  assert.equal(litPixels(render(replay,{progress:p.progress})),0);
  replay.capture(replaySource,WIDTH,HEIGHT);
  assert.equal(JSON.stringify(replay.flashes),replaySnapshot,'the same drawing rebuilds deterministic impact flashes');
  for(const empty of [null,input([]),input(points,{trailEnabled:false}),
    input([{x:NaN,y:100}]),{...input(),opacity(){return 0;}}]){
    const blank=new RevealGather();blank.capture(empty,WIDTH,HEIGHT);
    assert.equal(blank.flashes.length,0,'empty or invisible drawings create no impact flashes');
    assert.equal(litPixels(render(blank,{progress:.32})),0,'empty input paints no flash pixels');
  }
}finally{Math.random=random;}

console.log('Reveal flashes: 20 percent larger, bounded 30-flash pool, full viewport and central coverage, fixed positions and angles, 90–180 ms pulses, sharp four-arm Canvas silhouette, immutable capture, staggered timing, pause parity, resize and final disappearance passed.');
