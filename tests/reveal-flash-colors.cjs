'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||
  'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/effect-settings.js');
require('../js/ribbon-renderer.js');
require('../js/reveal-gather.js');

const width=390,height=844,target={x:width/2,y:height/2};
const colors=['#00bdf2','#d600ff','#ffd600','#ff0000','#00ff00','#0000ff','#ffffff'];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
function make(color,brightness=100){
  const source={width,height,time:12,
    settings:EffectSettings.normalize({flashPalette:[color],flashOpacity:brightness,flashSize:250}),
    renderer:new RibbonRenderer({color:'#7deaff',width:1,glowSize:1}),opacity:()=>1,
    strokes:[{seed:7,color:'#7deaff',released:11.8,points:Array.from({length:140},(_,i)=>({
      x:195+Math.sin(i*.15)*135,y:422+Math.cos(i*.11)*240,speed:.4
    }))}]};
  const gather=new RevealGather();gather.capture(source,width,height);return gather;
}
function peak(gather,flash){
  let best={alpha:-1};
  for(let i=0;i<=200;i++){
    const progress=flash.start+flash.life*i/200,frame=gather.flashFrame(flash,progress);
    if(frame.alpha>best.alpha)best={...frame,progress};
  }
  return best;
}
function paint(gather,progress,method='drawFlashes',background=null){
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}
  gather[method](ctx,{progress,target});
  return {canvas,pixels:ctx.getImageData(0,0,width,height).data};
}
function strongest(pixels,x,y,reach=1){
  let best=[0,0,0,0];
  for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
    const px=Math.round(x)+dx,py=Math.round(y)+dy;
    if(px<0||px>=width||py<0||py>=height)continue;
    const p=Array.from(pixels.slice((py*width+px)*4,(py*width+px)*4+4));
    if(p[3]>best[3])best=p;
  }
  return best;
}
function chroma(pixel){
  const max=Math.max(...pixel.slice(0,3)),min=Math.min(...pixel.slice(0,3));
  return {max,saturation:max?(max-min)/max:0,normalized:pixel.slice(0,3).map(c=>max?c/max:0)};
}
function matchesSwatch(pixel,expected,label,tolerance=.035){
  const actual=chroma(pixel),wanted=chroma(expected);
  assert.ok(actual.max>12,label+' remains visible');
  if(wanted.saturation>.5)assert.ok(actual.saturation>=wanted.saturation-.04,
    `${label} retains the selected saturation: ${pixel} vs ${expected}`);
  actual.normalized.forEach((channel,i)=>assert.ok(Math.abs(channel-wanted.normalized[i])<=tolerance,
    `${label} retains the selected color ratio: ${pixel} vs ${expected}`));
}

const baseline=make(colors[0]);
const candidate=baseline.flashes.map((flash,index)=>({flash,index,p:peak(baseline,flash)}))
  .filter(({p})=>p.x>p.radius*1.2&&p.x<width-p.radius*1.2&&p.y>p.radius*1.2&&p.y<height-p.radius*1.2)
  .sort((a,b)=>b.p.radius-a.p.radius)[0];
assert.ok(candidate&&candidate.p.radius>35,'a real captured large flash fits inside the viewport');
const {index}=candidate;
const artifact=createCanvas(colors.length*160,250),art=artifact.getContext('2d');
art.fillStyle='#090a18';art.fillRect(0,0,artifact.width,artifact.height);
art.font='14px sans-serif';art.textAlign='center';
const originalStars=JSON.stringify(baseline.stars),originalOrbs=JSON.stringify(baseline.orbs);
const starPixels=Buffer.from(paint(baseline,.3,'drawStars').pixels);
for(let column=0;column<colors.length;column++){
  const color=colors[column],expected=rgb(color),gather=make(color),flash=gather.flashes[index],p=peak(gather,flash);
  assert.ok(gather.flashes.every(f=>f.color.every((n,i)=>n===expected[i])),
    'the settings palette reaches immutable captured flash colors');
  assert.equal(JSON.stringify(gather.stars),originalStars,'changing flash colors leaves rotating-star seeds and colors intact');
  assert.equal(JSON.stringify(gather.orbs),originalOrbs,'changing flash colors leaves magic-ball seeds and colors intact');
  assert.deepEqual(Buffer.from(paint(gather,.3,'drawStars').pixels),starPixels,
    'the independent rotating-star layer preserves exact pixels');

  // Keep one actual captured flash to inspect its core and thin arms without
  // overlapping events. No replacement drawing or synthetic color fill is used.
  const captured=gather.flashes;gather.flashes=Object.freeze([flash]);
  const isolated=paint(gather,p.progress),centre=strongest(isolated.pixels,p.x,p.y);
  assert.ok(centre[3]>240,'peak light stays strong after preserving saturation');
  matchesSwatch(centre,expected,color+' peak centre');
  const arms=[[.30,0],[-.30,0],[0,.30],[0,-.30]];
  for(const [x,y] of arms){
    const arm=strongest(isolated.pixels,p.x+x*p.radius,p.y+y*p.radius);
    assert.ok(arm[3]>25,'each thin arm remains visible');
    matchesSwatch(arm,expected,color+' arm',.05);
  }
  const dim=make(color,40);dim.flashes=Object.freeze([dim.flashes[index]]);
  const dimCentre=strongest(paint(dim,p.progress).pixels,p.x,p.y);
  assert.ok(dimCentre[3]<centre[3]*.75,'brightness setting actually dims the flash');
  matchesSwatch(dimCentre,expected,color+' dim centre');
  if(color==='#ffffff'){
    assert.ok(centre.slice(0,3).every(c=>c>=250),'white remains white');
    assert.ok(dimCentre.slice(0,3).every(c=>c>=250),'dim white does not acquire a tint');
  }

  // Production draw includes orbs and rotating stars before the flash. At the
  // peak the selected color must still be recognizable over their live pixels.
  gather.flashes=captured;
  const full=paint(gather,p.progress,'draw','#090a18');
  const fullCentre=strongest(full.pixels,p.x,p.y,0);
  matchesSwatch(fullCentre,expected,color+' full gather centre',.055);
  gather.flashes=Object.freeze([]);
  assert.notDeepEqual(Buffer.from(paint(gather,p.progress,'draw','#090a18').pixels),Buffer.from(full.pixels),
    'production gathering really paints the flash layer');

  art.fillStyle=color;art.fillRect(column*160+44,16,72,28);
  art.fillStyle='#e9eaf4';art.fillText(color,column*160+80,65);
  const extent=p.radius*2.5;
  art.drawImage(isolated.canvas,p.x-extent/2,p.y-extent/2,extent,extent,column*160+10,80,140,140);
  art.fillText('100%',column*160+80,237);
}
const output=path.join(__dirname,'../artifacts/reveal-flash-colors.png');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,artifact.toBuffer('image/png'));
console.log('Flash palette raster checks passed: saturated cyan/purple/yellow and RGB, white, peak centre and four arms, opacity scaling, production gather composition, and unchanged rotating stars/balls.');
