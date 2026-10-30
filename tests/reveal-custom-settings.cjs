'use strict';
const assert=require('node:assert/strict');
const {createCanvas}=require(process.env.MANA_CANVAS_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
require('../js/effect-settings.js');require('../js/ribbon-renderer.js');require('../js/reveal-gather.js');require('../js/reveal-flow.js');require('../js/reveal-atmosphere.js');
const w=390,h=844,target={x:w/2,y:h/2};
function make(settings={}){
  const source={width:w,height:h,time:10,settings:EffectSettings.normalize(settings),
    renderer:new RibbonRenderer({width:1}),opacity:()=>1,
    strokes:[{seed:7,color:'#7deaff',released:9.8,points:Array.from({length:160},(_,i)=>({x:195+Math.sin(i*.23)*130,y:422+Math.cos(i*.15)*240,speed:.5}))}]};
  const g=new RevealGather();g.capture(source,w,h);return {g,source};
}
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-8,msg+': '+a+' vs '+b);
const {g:base}=make(),{g:half}=make({burstCount:50}),{g:more}=make({burstCount:150});
assert.equal(base.orbs.length,180);assert.equal(half.orbs.length,90);assert.equal(more.orbs.length,270);
const {g:wide}=make({burstRadius:160}),orb=base.orbs[30];
const a=base.orbit(orb,target,1),b=wide.orbit(orb,target,1);
close(Math.hypot(b.px,b.py)/Math.hypot(a.px,a.py),1.6,'orb extent follows radius control');
const {g:flat}=make({burstDepth:0});assert.ok(flat.orbs.every(q=>flat.orbit(q,target,1).depth===0));
const {g:deep}=make({burstDepth:150});close(deep.orbit(orb,target,1).depth,a.depth*1.5,'depth control');
// Observe actual production draw arguments, then render the same frames with real Canvas.
function bodies(g){
  const frames=[],canvas=createCanvas(w,h);g.ball=(ctx,p,r,color,alpha)=>frames.push({p,r,color,alpha});
  g.draw(canvas.getContext('2d'),{progress:.4,target});return frames;
}
const plain=bodies(base),large=bodies(make({burstSize:150,burstOpacity:40}).g);
assert.equal(plain.length,large.length);
plain.forEach((p,i)=>{close(large[i].r,p.r*1.5,'orb size');close(large[i].alpha,p.alpha*.4,'orb opacity');});
const palette=['#ff0000','#00ff00','#0000ff','#abcdef','#fedcba'];
const {g:colored,source}=make({burstUseTrail:false,burstPalette:palette,burstStarPalette:palette,flashPalette:palette,burstStarCount:96,flashCount:60});
const allowed=new Set(palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(',')));
for(const pool of [colored.orbs,colored.stars,colored.flashes]){
  assert.equal(new Set(pool.map(q=>q.color.join(','))).size,5,'all custom colors can be selected');
  assert.ok(pool.every(q=>allowed.has(q.color.join(','))));
}
assert.equal(colored.stars.length,96);assert.equal(colored.flashes.length,60);
const shortSource={width:w,height:h,time:1,settings:EffectSettings.normalize({burstCount:25,burstStarCount:96,flashCount:60}),
  strokes:[{seed:1,color:'#7deaff',points:[{x:100,y:200},{x:130,y:230}]}],opacity:()=>1};
const shortGather=new RevealGather();shortGather.capture(shortSource,w,h);
assert.ok(shortGather.orbs.length<30,'short drawing with low orb density');
assert.equal(shortGather.stars.length,96,'star count independent of magic ball density');
assert.equal(shortGather.flashes.length,60,'flash count independent of magic ball density');
const snapshot=JSON.stringify(colored.settings);source.settings.flashPalette[0]='#000000';
assert.equal(JSON.stringify(colored.settings),snapshot,'settings copied at capture');
assert.ok(Object.isFrozen(colored.settings.flashPalette[0]));
const {g:none}=make({burstStarEnabled:false,flashEnabled:false});assert.equal(none.stars.length+none.flashes.length,0);
const {g:zero}=make({burstStarCount:0,flashCount:0});assert.equal(zero.stars.length+zero.flashes.length,0);
const {g:starScaled}=make({burstStarSize:150,burstStarOpacity:40,burstStarSpin:0});
const star=base.stars[0],progress=star.start+star.life*.4;
const sa=base.starFrame(star,progress,target),sb=starScaled.starFrame(starScaled.stars[0],progress,target);
close(sb.radius,sa.radius*1.5,'star size');close(sb.alpha,sa.alpha*.4,'star opacity');
close(sb.angle,star.rotation,'zero spin is stationary');
const {g:flashScaled}=make({flashSize:150,flashOpacity:40}),flash=base.flashes[0],fp=flash.start+flash.life*.3;
const fa=base.flashFrame(flash,fp),fb=flashScaled.flashFrame(flashScaled.flashes[0],fp);
close(fb.radius,fa.radius*1.5,'flash size');close(fb.alpha,fa.alpha*.4,'flash opacity');
for(const duration of [1.2,2.1,4]){
  const {g}=make({burstDuration:duration});
  close(g.flashes[0].life*duration,flash.life*2.1,'flash actual lifetime independent of choreography duration');
  const doubled=make({burstDuration:duration,flashDuration:.28}).g;
  close(doubled.flashes[0].life*duration,flash.life*2.1*2,'flash lifetime control');
  const f=new RevealFlow({burstDuration:duration,burstRadius:160});
  f.down(1,0,0);f.move(1,30,30);f.up(1);
  for(let i=0;i<34;i++)f.step(.05); // Two inward waves plus the current 0.5 s pressure hold.
  assert.equal(f.state,'GATHER');
  for(let i=0;i<Math.round(duration*20)-1;i++)f.step(.05);
  assert.equal(f.state,'GATHER');assert.ok(f.progress>.94);f.step(.05);assert.equal(f.state,'FORM');
  f.reset();assert.equal(f.gatherDuration,duration,'replay retains chosen duration');
}
const cloud={seed:4,x:370,y:420,angle:0,depth:.7};
const normal=new RevealAtmosphere(),expanded=new RevealAtmosphere();
normal.step(.05,{state:'GATHER',progress:.6});expanded.step(.05,{state:'GATHER',progress:.6,burstRadius:160});
const p=normal.point(cloud,'mist',w,h,target),q=expanded.point(cloud,'mist',w,h,target);
close(Math.hypot(q.x-target.x,q.y-target.y)/Math.hypot(p.x-target.x,p.y-target.y),1.6,'mist follows same radius setting');
// Maximum user-exposed settings remain drawable, deterministic on pause and finish empty.
const extreme=make({burstCount:150,burstSize:200,burstRadius:160,burstDepth:150,burstDuration:1.2,burstStarCount:96,burstStarSize:200,flashCount:60,flashSize:250,flashDuration:.3}).g;
const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
function paint(progress){ctx.clearRect(0,0,w,h);extreme.draw(ctx,{progress,target});return Buffer.from(ctx.getImageData(0,0,w,h).data);}
for(const progress of [.05,.4,.7,.94])assert.deepEqual(paint(progress),paint(progress),'same clock renders same frame');
ctx.clearRect(0,0,w,h);extreme.draw(ctx,{progress:1,formation:1,target});
assert.ok(ctx.getImageData(0,0,w,h).data.every(n=>n===0));
console.log('Reveal custom settings: render sizes/brightness/counts/colors/depth, synced atmosphere extent, actual pulse duration, replay pacing and bounded Canvas extremes passed.');
