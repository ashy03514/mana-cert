'use strict';
// Actual Canvas fallback plus the public absolute-clock contract. GPU and host
// integration live in wind-backdrop-browser.cjs; device appearance stays manual.
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/wind-backdrop.js');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
const create=()=>new WindBackdrop(()=>createCanvas(1,1));
const backdrop=create();
function frame(time,{width=390,height=844,strength=1,opacity=1,owner=backdrop}={}){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.fillStyle='#080915';ctx.fillRect(0,0,width,height);
  const before=Buffer.from(ctx.getImageData(0,0,width,height).data);
  ctx.globalAlpha=.57;ctx.globalCompositeOperation='screen';ctx.translate(2,3);
  ctx.lineWidth=3;ctx.shadowColor='#b2c3d4';ctx.shadowBlur=0;
  const matrix=ctx.getTransform(),alpha=ctx.globalAlpha;
  const options={time,strength,opacity,
    focus:{x:width*.26,y:height*.23,width:width*.48,height:height*.44},
    readout:{x:width*.25,y:height*.78,width:width*.50,height:height*.14}};
  const input=JSON.stringify(options),painted=owner.draw(ctx,width,height,options);
  close(ctx.globalAlpha,alpha,'caller opacity restored');
  assert.equal(ctx.globalCompositeOperation,'screen','caller blend restored');
  assert.deepEqual(ctx.getTransform(),matrix,'caller transform restored');
  assert.equal(ctx.lineWidth,3,'caller stroke restored');
  assert.equal(ctx.shadowColor,'#b2c3d4','caller shadow restored');
  assert.equal(JSON.stringify(options),input,'input frame is not mutated');
  const pixels=Buffer.from(ctx.getImageData(0,0,width,height).data);
  // napi Canvas can report a stale gradient getter after restore. Its next
  // painted pixel is the meaningful check of the saved fill style.
  ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';
  ctx.fillRect(0,0,1,1);
  assert.deepEqual([...ctx.getImageData(0,0,1,1).data],[8,9,21,255],'caller fill restored');
  ctx.restore();
  return {painted,before,pixels};
}

const start=WindBackdrop.sample(0);
assert.equal(start.cycle,0);assert.equal(start.phase,0);
for(const bad of [-5,NaN,Infinity,-Infinity])
  assert.deepEqual(WindBackdrop.sample(bad),start,'invalid/negative clocks start at zero');
for(const time of [.05,.125,.25,.5,.875,1.25,1.75,9.25,1000.75]){
  const a=WindBackdrop.sample(time),b=WindBackdrop.sample(time+2);
  assert.equal(b.cycle,a.cycle+1,'a new circulation launches every two visual seconds');
  for(const key of ['phase','inward','rise','release','pulse']){
    assert.ok(Number.isFinite(a[key])&&a[key]>=0&&a[key]<=1,key+' is finite and bounded');
    close(b[key],a[key],key+' follows the absolute two-second clock');
  }
  WindBackdrop.sample(time+6.7);
  assert.deepEqual(WindBackdrop.sample(time),a,'sampling after a rewind has no hidden state');
}
assert.ok(WindBackdrop.sample(.9).rise>WindBackdrop.sample(.15).rise,'the pulse rises after the inward phase');
assert.ok(WindBackdrop.sample(1.6).release>WindBackdrop.sample(.5).release,'the late pulse releases outward');

for(const opacity of [0,-1,NaN,Infinity]){
  const result=frame(.8,{opacity});
  assert.equal(result.painted,false,'invalid or invisible opacity skips painting');
  assert.ok(result.before.equals(result.pixels),'skipped drawing preserves the original scene');
}
for(const [width,height] of [[320,568],[390,844],[844,390]]){
  for(const time of [.15,.5,.9,1.4,2.9,1000.75]){
    const first=frame(time,{width,height});
    assert.equal(first.painted,true,'Canvas fallback renders without WebGL');
    assert.ok(!first.before.equals(first.pixels),'fallback produces visible atmosphere');
    frame(time+.73,{width,height});
    assert.ok(first.pixels.equals(frame(time,{width,height}).pixels),'pause and rewind are pixel-identical');
  }
}
assert.ok(!frame(.5).pixels.equals(frame(1.2).pixels),'fallback mist moves with the supplied clock');
assert.ok(frame(.8,{opacity:4}).pixels.equals(frame(.8,{opacity:1}).pixels),'opacity above one is clamped');
assert.ok(frame(.8,{strength:-2}).pixels.equals(frame(.8,{strength:0}).pixels),'negative strength is clamped');
assert.ok(frame(.8,{strength:4}).pixels.equals(frame(.8,{strength:1.4}).pixels),'excess strength is clamped');
const perimeter=pixels=>{
  let sum=0;
  for(let y=0;y<844;y++)for(let x=0;x<46;x++){
    const i=(y*390+x)*4;sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
  }
  return sum;
};
assert.ok(perimeter(frame(.8,{strength:1.2}).pixels)>perimeter(frame(.8,{strength:.2}).pixels)*1.12,
  'the same wind design grows visibly brighter with continuous strength');

const ctx=createCanvas(16,16).getContext('2d');
for(const [width,height] of [[0,16],[16,0],[-1,16],[NaN,16],[16,Infinity]])
  assert.equal(backdrop.draw(ctx,width,height,{time:1}),false,'invalid viewport does not render');
backdrop.dispose();backdrop.dispose();
const disposed=frame(.8);
assert.equal(disposed.painted,false,'disposed backdrop cannot draw again');
assert.ok(disposed.before.equals(disposed.pixels),'disposed backdrop leaves its caller untouched');
const replacement=create();
assert.equal(frame(.8,{owner:replacement}).painted,true,'a new lifecycle can render after disposal');
replacement.dispose();
console.log('Wind backdrop CPU passed: absolute two-second phases, deterministic Canvas fallback, strength/opacity bounds, state restoration and disposal.');
