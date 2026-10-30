/* Real Canvas evidence for atmosphere visibility, separate from sphere brightness. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
for(const name of ['config','effect-settings','ribbon-renderer','finger-trails','portal-scene','reveal-atmosphere'])require('../js/'+name+'.js');

const WIDTH=390,HEIGHT=844,DURATION=2.1;
const target={x:WIDTH/2,y:HEIGHT/2+35};
const create=()=>createCanvas(1,1);
function harness(kind){
  const canvas=createCanvas(WIDTH,HEIGHT),ctx=canvas.getContext('2d');
  const scene=new PortalScene(ctx,WIDTH,HEIGHT,create,{mistEnabled:kind==='mist'||kind==='both',dotEnabled:kind==='dot'||kind==='both',starEnabled:false});
  const atmosphere=new RevealAtmosphere();
  // A real, deterministic moving portal, not synthetic isolated primitives.
  for(let frame=0;frame<90;frame++)scene.step(1/60);
  return {canvas,ctx,scene,atmosphere};
}
function render(h,state,progress,transformed=true){
  h.atmosphere.step(0,{state,progress});
  const transform=transformed?(q,kind)=>h.atmosphere.point(q,kind,WIDTH,HEIGHT,target):null;
  // Use the same composition path as drawFlowPreview, including its dim level.
  h.scene.draw(null,{transform,trails:false,dim:state==='GATHER'?.16*progress:0});
  return h.ctx.getImageData(0,0,WIDTH,HEIGHT).data;
}
function contribution(actual,background,minRadius,maxRadius){
  let pixels=0,visible=0,strong=0,total=0,max=0;
  const mask=new Uint8Array(WIDTH*HEIGHT);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const radius=Math.hypot(x-target.x,y-target.y);
    if(radius<minRadius||radius>=maxRadius)continue;
    const i=(y*WIDTH+x)*4;
    const delta=Math.max(actual[i]-background[i],actual[i+1]-background[i+1],actual[i+2]-background[i+2]);
    pixels++;total+=Math.max(0,delta);max=Math.max(max,delta);
    if(delta>=4)visible++;
    if(delta>=24){strong++;mask[y*WIDTH+x]=1;}
  }
  // A recognizable dot must occupy at least three connected, high-contrast
  // pixels; a single anti-aliased subpixel is not a readable moving particle.
  let dots=0;
  for(let start=0;start<mask.length;start++){
    if(!mask[start])continue;
    const stack=[start];mask[start]=0;let area=0;
    while(stack.length){
      const i=stack.pop(),x=i%WIDTH,y=Math.floor(i/WIDTH);area++;
      for(const j of [x>0?i-1:-1,x<WIDTH-1?i+1:-1,y>0?i-WIDTH:-1,y<HEIGHT-1?i+WIDTH:-1]){
        if(j>=0&&mask[j]){mask[j]=0;stack.push(j);}
      }
    }
    if(area>=3)dots++;
  }
  return {pixels,visible,strong,energy:total,mean:total/pixels,max,dots};
}

const empty=harness('none'),mist=harness('mist'),dot=harness('dot');
// No choreography before anticipation: the transformed default is byte-identical.
for(const h of [mist,dot])for(const state of ['DRAWING','WAITING']){
  h.atmosphere.reset();
  assert.deepEqual(render(h,state,.3),render(h,state,.3,false),'ordinary drawing/early waiting keeps the approved portal pixels');
}
const times=[1.65,1.75,1.85,1.95];
const records=[];
const sheet=createCanvas(WIDTH*times.length,HEIGHT*2),sc=sheet.getContext('2d');
for(const seconds of times){
  const p=seconds/DURATION,background=render(empty,'GATHER',p),record={seconds};
  for(const [kind,h,row] of [['mist',mist,0],['dot',dot,1]]){
    const pixels=render(h,'GATHER',p);
    record[kind]={middle:contribution(pixels,background,75,170),inner:contribution(pixels,background,25,75)};
    assert.deepEqual(pixels,render(h,'GATHER',p),'a paused atmosphere frame is pixel-identical');
    sc.drawImage(h.canvas,times.indexOf(seconds)*WIDTH,row*HEIGHT);
    sc.fillStyle='#ddd';sc.font='15px sans-serif';sc.fillText(kind+' '+seconds.toFixed(2)+' s',times.indexOf(seconds)*WIDTH+12,row*HEIGHT+25);
  }
  records.push(record);
}
// The atmosphere must visibly cross the middle and inner screen, independently
// of the much brighter magic spheres. Test 200 ms of motion, not one lucky frame.
for(const seconds of [1.75,1.85]){
  const r=records.find(r=>r.seconds===seconds);
  assert.ok(r.mist.middle.visible/r.mist.middle.pixels>.2&&r.mist.middle.mean>=4,
    `at ${seconds}s a broad, visible mist front crosses the middle of the screen`);
  assert.ok(r.dot.middle.dots>=5,`at ${seconds}s at least five distinct white dots cross the middle`);
}
for(const seconds of [1.85,1.95]){
  const r=records.find(r=>r.seconds===seconds);
  assert.ok(r.mist.inner.visible/r.mist.inner.pixels>.25&&r.mist.inner.mean>=6,
    `at ${seconds}s mist remains visible within 25-75 CSS px of the material target`);
  assert.ok(r.dot.inner.dots>=5,`at ${seconds}s at least five distinct white dots reach the inner screen`);
}
// Combined atmosphere must disappear on arrival without turning the centre
// into the overexposed white ball reported in earlier effect iterations.
const both=harness('both');let brightestCoreMean=0,nearWhitePixels=0;
for(let tick=160;tick<=210;tick++){
  const pixels=render(both,'GATHER',tick/100/DURATION);let sum=0,count=0;
  for(let y=Math.floor(target.y)-12;y<=target.y+12;y++)for(let x=Math.floor(target.x)-12;x<=target.x+12;x++){
    if(Math.hypot(x-target.x,y-target.y)>12)continue;
    const i=(y*WIDTH+x)*4;sum+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];count++;
    if(pixels[i]>=235&&pixels[i+1]>=235&&pixels[i+2]>=235)nearWhitePixels++;
  }
  brightestCoreMean=Math.max(brightestCoreMean,sum/count);
}
if(process.env.MANA_RENDER_REPORT){
  const folder=path.resolve(__dirname,'../artifacts');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'reveal-atmosphere-isolated.png'),sheet.toBuffer('image/png'));
  console.log(JSON.stringify({records,brightestCoreMean,nearWhitePixels},null,2));
}
// A small purple concentration is intentional. Keep its average luminance below
// half white, while rejecting any fully near-white pixel from overlapping haze.
assert.ok(brightestCoreMean<128,`arrival stays a restrained coloured core rather than an overexposed mass: peak mean ${brightestCoreMean.toFixed(1)}/255`);
assert.equal(nearWhitePixels,0,'the atmosphere never introduces clipped white pixels at the target');
assert.deepEqual(render(both,'GATHER',1),render(empty,'GATHER',1),'all atmosphere has faded on actual arrival');
console.log('Reveal atmosphere render: visible inward mist, distinct white dots, bounded centre brightness, complete arrival fade, unchanged waiting appearance and pixel-exact pause passed.');
