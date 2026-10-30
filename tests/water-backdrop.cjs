'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/element-reveal-backdrop.js');
const backdrop=new ElementRevealBackdrop(()=>createCanvas(1,1));
for(const [w,h] of [[390,844],[844,390]]){
  let previous=ElementRevealBackdrop.sample(0,w,h,'water').y;
  assert.ok(previous<0,'waterfall begins above screen');
  for(let i=1;i<=33;i++){
    const f=ElementRevealBackdrop.sample(i*.05,w,h,'water');
    assert.ok(f.y>previous,'water energy moves continuously downward');previous=f.y;
    const repeat=ElementRevealBackdrop.sample(i*.05+2,w,h,'water');
    assert.ok(Math.abs(f.y-repeat.y)<1e-8,'two-second cadence');
    const fire=ElementRevealBackdrop.sample(i*.05,w,h);
    assert.ok(Math.abs(f.y+fire.y-h)<1e-8,'water reverses the existing fire travel');
  }
  assert.ok(previous>h,'waterfall reaches below screen');
}
function frame(time,power=1,element='water'){
  const canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  ctx.globalAlpha=.6;ctx.globalCompositeOperation='screen';ctx.fillStyle='#8d2c44';
  const options={element,time,waterPower:power,focus:{x:80,y:190,width:230,height:400}};
  const input=JSON.stringify(options);
  const painted=backdrop.draw(ctx,390,844,options);
  assert.equal(ctx.globalAlpha,.6);assert.equal(ctx.globalCompositeOperation,'screen');
  assert.equal(JSON.stringify(options),input);
  return {painted,pixels:Buffer.from(ctx.getImageData(0,0,390,844).data)};
}
const paused=frame(.8);
frame(1.3);frame(2.8,3,'fire');
assert.ok(paused.pixels.equals(frame(.8).pixels),'replay, pause and attribute switches preserve exact water frame');
assert.ok(!paused.pixels.equals(frame(1.3).pixels),'waterfall moves over time');
assert.ok(!frame(.8,0).pixels.equals(frame(.8,3).pixels),'water energy grows with mana');
assert.equal(frame(0).painted,false,'formation starts transparently');
let r=0,b=0;for(let i=0;i<paused.pixels.length;i+=4){r+=paused.pixels[i];b+=paused.pixels[i+2];}
assert.ok(b>r*3,'water has a blue palette');
console.log('Water backdrop: downward travel, two-second cadence, blue palette, mana response, Canvas restore and deterministic pause passed.');
