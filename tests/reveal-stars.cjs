'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/ribbon-renderer.js');
require('../js/reveal-gather.js');

const WIDTH=390,HEIGHT=844,target={x:WIDTH/2,y:HEIGHT/2};
function input(points,settings={}){
  return {width:WIDTH,height:HEIGHT,time:12,
    settings:{trailEnabled:true,trailOpacity:100,...settings},
    renderer:new RibbonRenderer({color:'#7deaff',width:1,glowSize:1}),
    strokes:[{seed:7,color:'#7deaff',released:11.8,points}],opacity(){return 1;}};
}
const points=Array.from({length:140},(_,i)=>({
  x:195+Math.sin(i*.15)*135,y:422+Math.cos(i*.11)*240,speed:.4
}));
function finiteFrame(frame){
  for(const key of ['x','y','z','radius','angle','alpha']){
    assert.ok(Number.isFinite(frame[key]),`star ${key} must remain finite`);
  }
  assert.ok(frame.radius>0,'star radii stay positive');
  assert.ok(frame.alpha>=0&&frame.alpha<=1,'star opacity stays bounded');
  assert.ok(frame.color.every(n=>Number.isFinite(n)&&n>=0&&n<=255));
}
function render(gather,frame={},full=false){
  const canvas=createCanvas(Math.max(1,gather.width),Math.max(1,gather.height));
  const ctx=canvas.getContext('2d');
  ctx.globalAlpha=.73;ctx.fillStyle='#123456';ctx.globalCompositeOperation='source-over';
  const state=[ctx.globalAlpha,ctx.globalCompositeOperation];
  ctx.fillRect(0,0,1,1);
  const callerPaint=Buffer.from(ctx.getImageData(0,0,1,1).data);
  ctx.clearRect(0,0,1,1);
  gather[full?'draw':'drawStars'](ctx,{target,...frame});
  assert.deepEqual([ctx.globalAlpha,ctx.globalCompositeOperation],state,
    'star drawing restores the caller canvas state');
  const pixels=Buffer.from(ctx.getImageData(0,0,canvas.width,canvas.height).data);
  // This Canvas runtime caches the fillStyle getter across restore(), but its
  // actual paint state is correct. Check the resulting paint, not that getter.
  ctx.clearRect(0,0,1,1);ctx.fillRect(0,0,1,1);
  assert.deepEqual(Buffer.from(ctx.getImageData(0,0,1,1).data),callerPaint,
    'star drawing restores the caller paint color');
  return pixels;
}
function litPixels(pixels,threshold=0){
  let count=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>threshold)count++;
  return count;
}

const source=input(points),gather=new RevealGather();
const random=Math.random;
Math.random=()=>{throw Error('burst stars must not consume result randomness');};
try{
  gather.capture(source,WIDTH,HEIGHT);
  assert.ok(gather.stars.length>=24&&gather.stars.length<=48,
    'a substantial drawing produces many stars with a fixed resource bound');
  assert.ok(Object.isFrozen(gather.stars));
  for(const star of gather.stars){
    assert.ok(Object.isFrozen(star)&&Object.isFrozen(star.color)&&Object.isFrozen(star.orb),
      'star seeds, colors and source positions are immutable');
  }
  assert.throws(()=>{gather.stars[0].size=100;},TypeError);
  assert.throws(()=>{gather.stars[0].color[0]=0;},TypeError);
  const snapshot=JSON.stringify(gather.stars);
  source.strokes[0].points[0].x=-1000;
  source.settings.burstStarPalette=['#ff0000'];
  assert.equal(JSON.stringify(gather.stars),snapshot,'live input edits cannot alter burst stars');

  // Evaluate each complete life rather than a chosen bright frame. Every star
  // turns, and small and large stars coexist across the independently timed lives.
  const peaks=[],peakTimes=[],quadrants=new Set(),radialBands=new Set();
  let visibleOnscreen=0,maximumConcurrent=0;
  for(const star of gather.stars){
    const visible=[];let peakAlpha=0,peakAt=0,maxRadius=0;
    for(let step=0;step<=160;step++){
      const progress=step/160,frame=gather.starFrame(star,progress,target);
      finiteFrame(frame);
      if(frame.alpha>.05){
        visible.push(frame);maxRadius=Math.max(maxRadius,frame.radius);
      }
      if(frame.alpha>peakAlpha){peakAlpha=frame.alpha;peakAt=progress;}
    }
    assert.ok(visible.length>8,'each star has a readable visible lifetime');
    assert.ok(Math.abs(visible.at(-1).angle-visible[0].angle)>.1,
      'each visible star rotates on its own');
    peaks.push(maxRadius);peakTimes.push(peakAt);
  }
  assert.ok(Math.max(...peaks)>Math.min(...peaks)*2.2,'stars show a clear size range');
  assert.ok(Math.max(...peakTimes)-Math.min(...peakTimes)>.18,
    'twinkles peak at different moments rather than flashing together');
  for(const progress of [.2,.3,.4,.5,.6]){
    let concurrent=0;
    for(const star of gather.stars){
      const frame=gather.starFrame(star,progress,target);
      if(frame.alpha<.12||frame.x<frame.radius||frame.x>WIDTH-frame.radius||
          frame.y<frame.radius||frame.y>HEIGHT-frame.radius)continue;
      visibleOnscreen++;concurrent++;
      const dx=frame.x-WIDTH/2,dy=frame.y-HEIGHT/2;
      quadrants.add((dx<0?'left':'right')+(dy<0?'top':'bottom'));
      radialBands.add(Math.floor(Math.hypot(dx,dy)/70));
    }
    maximumConcurrent=Math.max(maximumConcurrent,concurrent);
  }
  assert.ok(visibleOnscreen>35&&maximumConcurrent>=12,
    'many readable stars remain inside the phone viewport');
  assert.equal(quadrants.size,4,'visible stars occupy every side of the burst');
  assert.ok(radialBands.size>=3,'visible stars have depth across the burst field');

  // Test the real Canvas output, including pause and replay. Rendering other
  // times or material colors must never alter the same reveal-clock frame.
  const still=render(gather,{progress:.32,time:1,element:'fire'});
  assert.ok(litPixels(still,12)>500,'the star layer produces visible pixels');
  assert.ok(litPixels(still,128)<WIDTH*HEIGHT*.05,'star cores do not become a full-screen flash');
  render(gather,{progress:.61,time:10,element:'dark'});
  assert.deepEqual(render(gather,{progress:.32,time:99,element:'water'}),still,
    'paused stars have identical pixels independent of render history and wall time');
  assert.notDeepEqual(render(gather,{progress:.4}),still,'advancing reveal time animates the layer');
  for(const progress of [0,.8,.9,1,2]){
    assert.equal(litPixels(render(gather,{progress})),0,
      'stars are absent before the burst and during the final inward gathering');
  }
  for(const formation of [.001,.1,.5,1]){
    assert.equal(litPixels(render(gather,{progress:.32,formation})),0,
      'the material formation phase does not retain burst stars');
  }
  const combined=render(gather,{progress:.32},true),drawStars=gather.drawStars;
  gather.drawStars=()=>{};
  assert.notDeepEqual(render(gather,{progress:.32},true),combined,
    'the production gather drawing includes the star layer');
  gather.drawStars=drawStars;
  assert.equal(JSON.stringify(gather.stars),snapshot,'drawing never mutates star seeds');

  for(const size of [[780,1688],[844,390],[1,1],[390,844],[NaN,844],[-1,0]]){
    const previous=[gather.width,gather.height];
    gather.resize(...size);
    if(size.some(n=>!Number.isFinite(n)||n<=0))assert.deepEqual([gather.width,gather.height],previous);
    for(const progress of [-1,NaN,Infinity,.25,.55,.9,1]){
      for(const star of gather.stars){
        finiteFrame(gather.starFrame(star,progress,{x:NaN,y:Infinity},NaN));
      }
      render(gather,{progress,target:{x:NaN,y:Infinity}});
    }
  }
  assert.equal(JSON.stringify(gather.stars),snapshot,'resize only changes the projection');

  const busy=input(Array.from({length:1200},(_,i)=>({x:i%2?380:10,y:20+i*79%804})));
  busy.strokes=Array.from({length:32},(_,seed)=>({...busy.strokes[0],seed}));
  const bounded=new RevealGather();bounded.capture(busy,WIDTH,HEIGHT);
  assert.ok(bounded.stars.length<=48,'very long drawings do not grow the star pool');

  const replay=new RevealGather(),replaySource=input(points.map(p=>({...p})),{starEnabled:false});
  replay.capture(replaySource,WIDTH,HEIGHT);
  assert.ok(replay.stars.length>0,'the brief burst accent is independent of ambient star visibility');
  const replaySnapshot=JSON.stringify(replay.stars);
  replay.capture(null,WIDTH,HEIGHT);
  assert.equal(replay.stars.length,0,'capture clears the previous reveal');
  assert.equal(litPixels(render(replay,{progress:.32})),0);
  replay.capture(replaySource,WIDTH,HEIGHT);
  assert.equal(JSON.stringify(replay.stars),replaySnapshot,'replay rebuilds the same seeded burst');

  for(const empty of [null,{...input([])},input(points,{trailEnabled:false}),
    input([{x:NaN,y:100}]),{...input(points),opacity(){return 0;}}]){
    const blank=new RevealGather();blank.capture(empty,WIDTH,HEIGHT);
    assert.equal(blank.stars.length,0,'empty or invisible drawings do not create stars');
    assert.equal(litPixels(render(blank,{progress:.32})),0,'empty input paints no pixels');
  }
}finally{Math.random=random;}

console.log('Reveal stars: bounded immutable capture, visible coverage, varied size, staggered twinkle, self-rotation, real Canvas pause parity, resize and final disappearance passed.');
