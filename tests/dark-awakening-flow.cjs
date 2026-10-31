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
   const opening=enabled?(element==='dark'?2.7:1.9):0;
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
 advance(flow,.01);assert.equal(flow.state,'AWAKEN');assert.equal(flow.duration,2.7);close(flow.elapsed,0,'opening starts fresh');
 assert.equal(flow.materialFrame,null);assert.equal(flow.down(2,60,60),false,'input cannot restart opening');
 advance(flow,.6);flow.paused=true;const held=JSON.stringify(flow);advance(flow,8);assert.equal(JSON.stringify(flow),held);
 flow.cancelPointer();assert.equal(flow.state,'AWAKEN');close(flow.elapsed,.6,'lifecycle cancellation retains stage');
 flow.paused=false;advance(flow,2.1);assert.equal(flow.state,'FORM');close(flow.materialFrame.time,0,'wing time starts after opening');
 advance(flow,.4);close(flow.materialFrame.opacity,.5,'soft wing handoff');close(flow.materialFrame.time,.4,'wing clock');
 advance(flow,.4);assert.equal(flow.state,'REVEAL');close(flow.elapsed,0,'scan starts fresh');
 advance(flow,20);assert.equal(flow.state,'REVEAL');close(flow.elapsed,20,'held readout remains animated');close(flow.materialFrame.time,20.8,'continuous wing clock');
 // State transitions carry only frame remainder, without clipping an opening
 // or counting its duration toward wing evolution or numeric growth.
 flow.reset('dark');gather(flow);advance(flow,2.08);flow.step(.05);assert.equal(flow.state,'AWAKEN');close(flow.elapsed,.03,'gather remainder');
 advance(flow,2.64);flow.step(.05);assert.equal(flow.state,'FORM');close(flow.elapsed,.02,'opening remainder');
 advance(flow,.75);flow.step(.05);assert.equal(flow.state,'REVEAL');close(flow.elapsed,.02,'formation remainder');
 flow.reset('dark');assert.equal(flow.awakeningEnabled,true);assert.equal(flow.state,'DRAWING');assert.equal(flow.materialFrame,null);assert.equal(flow.paused,false);
 flow.down(1,0,0);flow.move(1,40,0);flow.up(1,{cancelled:true});advance(flow,10);assert.equal(flow.state,'DRAWING','cancel never launches ritual');
 flow.configure({}, {darkAwakening:false});flow.reset('dark');gather(flow);advance(flow,2.1);assert.equal(flow.state,'FORM','opting out restores direct reveal');
 flow.configure({}, {darkAwakening:true});flow.reset('dark');gather(flow);advance(flow,2.1+2.7+.8+1.8+.8);
 assert.equal(flow.state,'DONE');close(flow.materialFrame.time,3.4,'finished material clock excludes ritual');
 const effect=DarkAwakening;assert.equal(effect.duration,2.7);assert.equal(effect.totalDuration,3.5);
 for(const t of [NaN,Infinity,-Infinity,-10,0,.25,.95,1.55,2.35,2.7,3.1,3.5,100]){
  const s=effect.sample(t);assert.deepEqual(s,effect.sample(t),'repeated samples are deterministic');
  for(const field of ['time','charge','opening','handoff','live','illumination','absorb','flame'])assert.equal(Number.isFinite(s[field]),true,field+' finite');
  for(const field of ['charge','opening','handoff','live','illumination','absorb','flame'])assert.ok(s[field]>=0&&s[field]<=1,field+' bounded');
  assert.equal(typeof s.phase,'string');
 }
 close(effect.sample(2.7).handoff,0,'handoff starts after opening');close(effect.sample(3.5).handoff,1,'handoff ends after .8s form');
 close(effect.sample(3.5).live,0,'ritual fully gone before readout');
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
 // The renderer owns no result: all final ranks receive the identical opening.
 // Passing an unrelated result argument cannot select or mutate a destination.
 for(const rank of ['A','S','SS']){
  const result=Object.freeze({rank,mana:rank==='SS'?999:rank==='S'?900:750,element:'暗'});
  const before=JSON.stringify(result);assert.deepEqual(effect.sample(.9,result),effect.sample(.9));assert.equal(JSON.stringify(result),before);
 }
 console.log('PASS dark awakening flow: independent opt-in, 2.7s light-consuming ritual + preserved .8s wing formation, no early material, unchanged basic/light pacing, pause/replay/cancel/remainders, deterministic result-free samples.');
}finally{Math.random=random;}