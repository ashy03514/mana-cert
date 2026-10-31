'use strict';
const assert=require('node:assert/strict');
require('../js/reveal-flow.js');
require('../js/dark-awakening.js');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
function advance(flow,seconds){
 let remaining=seconds;
 while(remaining>1e-9){const dt=Math.min(.05,remaining);flow.step(dt);remaining-=dt;}
}
function sketch(flow){assert.equal(flow.down(1,20,30),true);assert.equal(flow.move(1,55,30),true);assert.equal(flow.up(1),true);}
function gather(flow){sketch(flow);advance(flow,1.7);assert.equal(flow.state,'GATHER');}
const random=Math.random;
Math.random=()=>{throw new Error('Presentation must not consume outcome randomness');};
try{
 // Each host opt-in is independent. Basic attributes and muggles retain their
 // direct handoff even when both rare openings are enabled.
 for(const lightAwakening of [false,true])for(const darkAwakening of [false,true]){
  for(const element of ['fire','water','wind','earth','light','dark',null]){
   const flow=new RevealFlow({}, {lightAwakening,darkAwakening});flow.reset(element);
   const enabled=element==='light'?lightAwakening:element==='dark'?darkAwakening:false;
   assert.equal(flow.awakeningEnabled,enabled,`${element} independent opt-in`);
   const opening=enabled?(element==='dark'?3.2:1.9):0;
   assert.equal(flow.awakeningDuration,opening);
   const formation=element==='light'&&enabled?.6:element==='fire'||element==='water'?1.2:.8;
   assert.equal(flow.formationDuration,formation,`${element} formation duration`);
   gather(flow);advance(flow,2.1);
   assert.equal(flow.state,enabled?'AWAKEN':'FORM');
   if(enabled){assert.equal(flow.materialFrame,null);advance(flow,opening);}
   assert.equal(flow.state,'FORM');close(flow.materialFrame.time,0,'material starts fresh');
   advance(flow,formation);assert.equal(flow.state,'REVEAL');close(flow.materialFrame.time,formation,'material excludes opening time');
  }
 }
 const flow=new RevealFlow({}, {holdAtReveal:true,darkAwakening:true});flow.reset('dark');
 gather(flow);advance(flow,2.09);assert.equal(flow.state,'GATHER');assert.equal(flow.materialFrame,null);
 advance(flow,.01);assert.equal(flow.state,'AWAKEN');assert.equal(flow.duration,3.2);close(flow.elapsed,0,'opening starts fresh');
 assert.equal(flow.materialFrame,null);assert.equal(flow.down(2,60,60),false,'input cannot restart opening');
 advance(flow,.6);flow.paused=true;const held=JSON.stringify(flow);advance(flow,8);assert.equal(JSON.stringify(flow),held);
 flow.cancelPointer();assert.equal(flow.state,'AWAKEN');close(flow.elapsed,.6,'lifecycle cancellation retains stage');
 flow.paused=false;advance(flow,2.6);assert.equal(flow.state,'FORM');close(flow.materialFrame.time,0,'wing time starts after opening');
 advance(flow,.4);close(flow.materialFrame.opacity,.5,'soft wing handoff');close(flow.materialFrame.time,.4,'wing clock');
 advance(flow,.4);assert.equal(flow.state,'REVEAL');close(flow.elapsed,0,'scan starts fresh');
 advance(flow,20);assert.equal(flow.state,'REVEAL');close(flow.elapsed,20,'held readout remains animated');close(flow.materialFrame.time,20.8,'continuous wing clock');
 // State transitions carry only frame remainder, without clipping an opening
 // or counting its duration toward wing evolution or numeric growth.
 flow.reset('dark');gather(flow);advance(flow,2.08);flow.step(.05);assert.equal(flow.state,'AWAKEN');close(flow.elapsed,.03,'gather remainder');
 advance(flow,3.14);flow.step(.05);assert.equal(flow.state,'FORM');close(flow.elapsed,.02,'opening remainder');
 advance(flow,.75);flow.step(.05);assert.equal(flow.state,'REVEAL');close(flow.elapsed,.02,'formation remainder');
 flow.reset('dark');assert.equal(flow.awakeningEnabled,true);assert.equal(flow.state,'DRAWING');assert.equal(flow.materialFrame,null);assert.equal(flow.paused,false);
 flow.down(1,0,0);flow.move(1,40,0);flow.up(1,{cancelled:true});advance(flow,10);assert.equal(flow.state,'DRAWING','cancel never launches ritual');
 flow.configure({}, {darkAwakening:false});flow.reset('dark');gather(flow);advance(flow,2.1);assert.equal(flow.state,'FORM','opting out restores direct reveal');
 flow.configure({}, {darkAwakening:true});flow.reset('dark');gather(flow);advance(flow,2.1+3.2+.8+1.8+.8);
 assert.equal(flow.state,'DONE');close(flow.materialFrame.time,3.4,'finished material clock excludes ritual');
 const effect=DarkAwakening;assert.equal(effect.duration,3.2);assert.equal(effect.totalDuration,4);
 for(const t of [NaN,Infinity,-Infinity,-10,0,.25,.95,1.55,2.35,2.85,3.15,3.2,3.6,4,100]){
  const s=effect.sample(t);assert.deepEqual(s,effect.sample(t),'repeated samples are deterministic');
  for(const field of ['time','charge','opening','handoff','live','illumination','absorb','flame'])assert.equal(Number.isFinite(s[field]),true,field+' finite');
  for(const field of ['charge','opening','handoff','live','illumination','absorb','flame'])assert.ok(s[field]>=0&&s[field]<=1,field+' bounded');
  assert.equal(typeof s.phase,'string');
 }
 close(effect.sample(3.2).handoff,0,'handoff starts after contraction');close(effect.sample(4).handoff,1,'handoff ends after .8s form');
 close(effect.sample(4).live,0,'atmospheric ritual ends before readout');
 assert.ok(effect.sample(.25).illumination>effect.sample(1.55).illumination,'background light is consumed');
 assert.ok(effect.sample(.95).absorb>effect.sample(.25).absorb,'suction builds after illumination');
 close(effect.sample(.95).flame,0,'flames wait until after suction');
 assert.ok(effect.sample(2.35).flame>0,'black magic flames release after swallowing');
 assert.deepEqual(effect.sample(-10),effect.sample(0));assert.deepEqual(effect.sample(NaN),effect.sample(0));
 // Every light/cloud follows one accelerating inward trajectory. Completed
 // particles disappear instead of teleporting outward to restart a loop.
 for(const cloud of [false,true])for(let index=0;index<172;index++){
  let previous=Infinity;
  for(const time of [.2,.4,.6,.8,1,1.2,1.4,1.6,1.8,2]){
   const p=effect.infall(index,time,390,844,195,334,cloud),radius=Math.hypot(p.x-195,p.y-334);
   assert.ok([p.x,p.y,p.alpha,p.q,p.size].every(Number.isFinite),'finite inward sample');
   assert.ok(radius<=previous+1e-8,'radius never moves outward during swallowing');previous=radius;
  }
  const end=effect.infall(index,2,390,844,195,334,cloud),later=effect.infall(index,2.5,390,844,195,334,cloud);
  close(end.q,1,'particle reaches horizon');close(end.alpha,0,'consumed light vanishes');
  close(later.alpha,0,'consumed light does not respawn');close(end.x,later.x,'no position reset');close(end.y,later.y,'no position reset');
 }
 // The same flame survives both clock boundaries. Contraction finishes
 // before the first wing, then its center follows the current wing root.
 const args={width:390,height:844,target:{x:195,y:334},art:{w:280,cx:195,cy:334},growth:0};
 const pose=t=>effect.flamePose({...args,elapsed:t});
 let lastSize=Infinity;
 for(let t=2.5;t<=3.20001;t+=.025){const p=pose(t);assert.ok(p.size<=lastSize+1e-8,'contraction is continuous and inward');lastSize=p.size;assert.equal(p.opacity,1,'black fire never fades during contraction');}
 assert.ok(pose(3.2).size<pose(2.35).size*.25,'black fire contracts substantially into the wing root');
 for(const boundary of [3.2,4]){const before=pose(boundary-1e-6),after=pose(boundary+1e-6);for(const field of ['x','y','size','time','formation','opacity'])assert.ok(Math.abs(after[field]-before[field])<1e-4,field+' remains continuous at '+boundary);}
 close(pose(4).y-pose(4).size*.20,args.art.cy,'persistent flame optical center aligns with wing root');
 const sizes=[0,1,2].map(growth=>effect.flamePose({...args,elapsed:10,growth}));
 assert.ok(sizes[0].size<sizes[1].size&&sizes[1].size<sizes[2].size,'A S SS flame size grows with wings');
 assert.ok(sizes[2].size<sizes[0].size*2,'rank growth remains moderate');
 for(const p of sizes){assert.equal(p.opacity,1);assert.equal(p.formation,1);assert.ok([p.x,p.y,p.size,p.time].every(Number.isFinite));}
 const late=effect.flamePose({...args,elapsed:100,growth:2});assert.equal(late.opacity,1,'settled flame persists');assert.ok(late.time>sizes[2].time,'settled flame continues flowing');
 // The renderer owns no result: all final ranks receive the identical opening.
 // Passing an unrelated result argument cannot select or mutate a destination.
 for(const rank of ['A','S','SS']){
  const result=Object.freeze({rank,mana:rank==='SS'?999:rank==='S'?900:750,element:'暗'});
  const before=JSON.stringify(result);assert.deepEqual(effect.sample(.9,result),effect.sample(.9));assert.equal(JSON.stringify(result),before);
 }
 console.log('PASS dark awakening flow: independent opt-in, 3.2s swallowing/eruption/contraction + preserved .8s wing formation, no early material, unchanged basic/light pacing, pause/replay/cancel/remainders, deterministic result-free samples.');
}finally{Math.random=random;}