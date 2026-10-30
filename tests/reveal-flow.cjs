const assert=require('node:assert/strict');
require('../js/reveal-flow.js');

function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} vs ${expected}`);}
function advance(flow,seconds){
  let remaining=seconds;
  while(remaining>1e-9){const dt=Math.min(.05,remaining);flow.step(dt);remaining-=dt;}
}
function sketch(flow,id=1){
  assert.equal(flow.down(id,20,40),true);
  assert.equal(flow.move(id,44,40),true);
  assert.equal(flow.up(id),true);
}

const f=new RevealFlow();
assert.equal(f.state,'DRAWING');assert.equal(f.element,'fire');
assert.equal(f.gatherDuration,2.1,'orb expansion and curved return share a 2.1-second gather clock');
assert.equal(f.pointerId,null);assert.equal(f.materialFrame,null);assert.equal(f.progress,0);
assert.equal(f.down(1,20,40),true);
for(let n=0;n<500;n++){f.move(1,20+Math.sin(n)*.8,40+Math.cos(n)*.8);f.step(.05);}
assert.equal(f.distance,0,'stationary input jitter cannot accumulate readiness');
assert.equal(f.up(1),true);advance(f,20);assert.equal(f.state,'DRAWING','a stationary tap never auto starts');
assert.equal(f.down(1,20,40),true);f.move(1,43,40);f.up(1);
assert.equal(f.ready,false);assert.equal(f.state,'DRAWING','short sketches wait for additional drawing');
f.down(1,60,40);f.move(1,62,40);f.up(1);
assert.equal(f.ready,true);assert.equal(f.state,'WAITING','valid stroke distance accumulates without counting gaps');
advance(f,1.1);assert.equal(f.state,'WAITING');close(f.progress,1.1/1.7,'quiet-period progress includes the post-wave hold');
assert.equal(f.down(2,100,60),true);assert.equal(f.state,'DRAWING');assert.equal(f.elapsed,0);
advance(f,2);assert.equal(f.state,'DRAWING','continuing to hold keeps the drawing open');
f.move(2,104,70);f.up(2);advance(f,1.69);
assert.equal(f.state,'WAITING','continuation receives a fresh quiet period');advance(f,.01);
assert.equal(f.state,'GATHER');assert.equal(f.materialFrame,null);
assert.equal(f.down(3,100,100),false,'transition ignores new drawing pointers');

f.reset('water');
assert.equal(f.down(null,1,2),false);assert.equal(f.down(undefined,1,2),false);
assert.equal(f.down(1,NaN,2),false);assert.equal(f.down(1,1,Infinity),false);
assert.equal(f.down(0,0,0),true,'pointer ID zero is valid');
assert.equal(f.down(1,100,100),false,'only the first pointer owns the sketch');
assert.equal(f.move(1,100,100),false);assert.equal(f.up(1),false);
assert.equal(f.move(0,Infinity,0),false);assert.equal(f.distance,0);
f.move(0,24,0);assert.equal(f.up(0,{cancelled:true}),true);
advance(f,5);assert.equal(f.state,'DRAWING','pointer cancellation never starts the reveal');
assert.equal(f.pointerId,null);assert.equal(f.distance,24);
sketch(f);advance(f,.7);f.cancelPointer();advance(f,4);
assert.equal(f.state,'DRAWING','background cancellation removes a pending countdown');

f.reset();sketch(f);advance(f,.5);
const snapshot=JSON.stringify(f);f.paused=true;
f.down(2,2,2);f.move(2,100,100);f.up(2);advance(f,5);
assert.equal(JSON.stringify({...f,paused:false}),snapshot,'pause freezes time and ordinary input');
f.paused=false;f.step(100);close(f.elapsed,.55,'large frames are clamped');
for(const dt of [0,-1,NaN,Infinity])f.step(dt);close(f.elapsed,.55,'invalid frames are ignored');
f.paused=true;f.cancelPointer();assert.equal(f.state,'DRAWING','lifecycle cleanup works while paused');
f.reset();f.down(1,0,0);f.paused=true;f.cancelPointer();
assert.equal(f.pointerId,null,'cleanup releases a paused pointer');

for(const element of ['fire','water','wind','earth','light','dark']){
  f.reset(element);assert.equal(f.element,element);assert.equal(f.distance,0);
  const formation=(element==='fire'||element==='water')?1.2:.8;
  close(f.formationDuration,formation,element+' has its own formation duration');
  sketch(f);advance(f,1.7);assert.equal(f.state,'GATHER');close(f.elapsed,0,'gather starts after the two waves and half-second hold');
  advance(f,2.09);assert.equal(f.state,'GATHER','the last 10 ms still belong to the orb return');
  close(f.progress,2.09/2.1,'gather progress uses the extended orb animation');
  assert.equal(f.materialFrame,null,'material cannot start before the orbs finish gathering');
  advance(f,.01);assert.equal(f.state,'FORM','formation begins at exactly 2.10 seconds');
  assert.deepEqual(f.materialFrame,{time:0,phase:0,opacity:(element==='fire'||element==='water')?1:0});
  advance(f,formation/2);close(f.progress,.5,'formation progress');
  close(f.materialFrame.opacity,(element==='fire'||element==='water')?1:.5,
    (element==='fire'||element==='water')?'fire grows a luminous volume instead of fading in':'other materials retain smooth formation opacity');
  const halfFormation=JSON.stringify(f.materialFrame),halfElapsed=f.elapsed;
  f.paused=true;advance(f,5);
  assert.equal(f.elapsed,halfElapsed,'pause freezes formation progress');
  assert.equal(JSON.stringify(f.materialFrame),halfFormation,'pause retains the same material frame');
  f.paused=false;advance(f,formation/2);
  assert.equal(f.state,'REVEAL');close(f.materialFrame.time,formation,'continuous material clock');
  assert.equal(f.materialFrame.opacity,1);
  advance(f,1.8);assert.equal(f.state,'SETTLE');close(f.materialFrame.time,formation+1.8,'settle material time');
  advance(f,.4);close(f.materialFrame.opacity,.725,'settle softens to a retained material');
  advance(f,.4);assert.equal(f.state,'DONE');assert.equal(f.progress,1);
  close(f.materialFrame.time,formation+2.6,'finished material time');close(f.materialFrame.phase,(formation+2.6)/6.4,'bounded renderer phase');
  close(f.materialFrame.opacity,.45,'finished material remains visible');
  const done=JSON.stringify(f),frame=JSON.stringify(f.materialFrame);
  advance(f,100);f.cancelPointer();
  assert.equal(JSON.stringify(f),done,'finished flow stays stable after cancellation');
  assert.equal(JSON.stringify(f.materialFrame),frame,'finished material never enters another loop');
}
f.reset('water');sketch(f);advance(f,2.5);f.paused=true;f.reset('wind');
assert.equal(f.state,'DRAWING');assert.equal(f.element,'wind');assert.equal(f.paused,false);
assert.equal(f.pointerId,null);assert.equal(f.elapsed,0);assert.equal(f.materialFrame,null);
f.reset('not-an-element');assert.equal(f.element,'fire','invalid selections use a known material');

for(const [element,total] of [['fire',7.6],['water',7.6]]){
  f.reset(element);sketch(f);advance(f,total-.01);
  assert.equal(f.state,'SETTLE',element+' is not done 10 ms before its complete release-to-afterglow duration');
  advance(f,.01);assert.equal(f.state,'DONE',element+' completes at exactly '+total+' seconds');
}

// A frame that crosses a phase boundary carries its fractional time forward.
f.reset();sketch(f);advance(f,1.69);f.step(.03);
assert.equal(f.state,'GATHER');close(f.elapsed,.02,'fractional phase carry');
advance(f,2.07);f.step(.03);
assert.equal(f.state,'FORM');close(f.elapsed,.02,'orb return carries its fractional time into formation');
for(let n=0;n<150;n++){
  f.step(.05);
  assert.ok(f.progress>=0&&f.progress<=1);
  const frame=f.materialFrame;
  if(frame)assert.ok(frame.opacity>=0&&frame.opacity<=1&&frame.phase>=0&&frame.phase<=1);
}

// Formal mode stops at a fully visible, continuously animated material. The
// host may select null for a no-element result without manufacturing fire.
const formal=new RevealFlow({burstDuration:2.8,burstRadius:120},{holdAtReveal:true});
assert.equal(formal.holdAtReveal,true);
for(const element of ['fire','water','wind','earth','light','dark',null]){
  formal.reset(element);assert.equal(formal.element,element);
  const formation=(element==='fire'||element==='water')?1.2:.8;
  close(formal.formationDuration,formation,'formal formation duration follows the selected material');
  assert.equal(formal.gatherDuration,2.8,'reset preserves the configured burst duration');
  assert.equal(formal.burstRadius,120,'reset preserves the configured burst radius');
  sketch(formal);advance(formal,1.7);assert.equal(formal.state,'GATHER');
  advance(formal,2.79);assert.equal(formal.state,'GATHER');
  advance(formal,.01);assert.equal(formal.state,'FORM');
  advance(formal,formation-.01);formal.step(.03);
  assert.equal(formal.state,'REVEAL');close(formal.elapsed,.02,'formal mode carries formation remainder');
  close(formal.materialFrame.time,formation+.02,'formal material clock starts continuously');
  assert.equal(formal.materialFrame.opacity,1);
  advance(formal,25);
  assert.equal(formal.state,'REVEAL','formal mode never proceeds to settle, done, or another result');
  close(formal.elapsed,25.02,'held reveal continues accumulating animation time');
  close(formal.materialFrame.time,formation+25.02,'shader time remains live after a long hold');
  assert.equal(formal.materialFrame.phase,.5,'late shader envelopes cannot fade or disassemble the material');
  assert.equal(formal.materialFrame.opacity,1);assert.equal(formal.progress,1);
  const held=JSON.stringify(formal);
  formal.cancelPointer();
  assert.equal(formal.down(2,100,100),false,'held reveal cannot start another drawing');
  assert.equal(formal.move(2,140,140),false);
  assert.equal(formal.up(2,{cancelled:true}),false);
  assert.equal(JSON.stringify(formal),held,'cancellation cannot unlock or restart the held material');
  formal.paused=true;
  const paused=JSON.stringify(formal),pausedFrame=JSON.stringify(formal.materialFrame);
  advance(formal,30);formal.cancelPointer();
  assert.equal(JSON.stringify(formal),paused,'paused formal mode remains stable');
  assert.equal(JSON.stringify(formal.materialFrame),pausedFrame,'pause freezes the shader clock');
  formal.paused=false;formal.step(.05);
  close(formal.materialFrame.time,formation+25.07,'resume advances the held shader clock');
  assert.equal(formal.materialFrame.phase,.5);assert.equal(formal.materialFrame.opacity,1);
}
formal.reset('invalid');assert.equal(formal.element,'fire','only explicit null bypasses an element');
formal.reset();assert.equal(formal.element,'fire','omitted selection retains the known default');
formal.configure({burstDuration:2.8});
assert.equal(formal.holdAtReveal,false,'ordinary preview configure explicitly clears formal mode');
formal.reset('water');sketch(formal);advance(formal,8.4);
assert.equal(formal.state,'DONE','preview completion is restored after formal mode');
close(formal.materialFrame.opacity,.45,'preview retains its original final opacity');
close(formal.materialFrame.phase,3.8/6.4,'preview phase is not capped to formal holding phase');
console.log('Reveal flow: input, cancellation, pause, preview timing and animated formal holds for six materials plus no-element passed.');
