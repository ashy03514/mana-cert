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
for(let n=0;n<59;n++){f.move(1,20+Math.sin(n)*.8,40+Math.cos(n)*.8);f.step(.05);}
assert.equal(f.distance,0,'stationary input jitter cannot accumulate drawing distance');
assert.equal(f.state,'DRAWING','held ring can continue filling after the optional early release threshold');
assert.equal(f.holdFrame.ready,true);assert.ok(f.holdFrame.progress<1);
f.step(.05);
assert.equal(f.state,'WAITING','full ring begins shockwaves without a lift or return phase');
assert.equal(f.completionSource,'autoHold');assert.equal(f.heldRelease,true);
assert.deepEqual(f.releasePoint,{x:20,y:40,age:3});
assert.equal(f.pointerId,null);assert.equal(f.holdFrame,null);
assert.equal(f.move(1,150,200),false);assert.equal(f.down(2,50,50),false);assert.equal(f.up(1),false);
f.cancelPointer();assert.equal(f.state,'WAITING','late pointer cleanup cannot cancel a committed auto hold');
advance(f,1.7);assert.equal(f.state,'GATHER');f.reset();
f.down(1,20,40);advance(f,.2);f.up(1);advance(f,20);
assert.equal(f.state,'DRAWING','a short stationary tap never auto starts');
assert.equal(f.down(1,20,40),true);f.move(1,43,40);f.up(1);
assert.equal(f.ready,false);assert.equal(f.state,'DRAWING','short sketches wait for additional drawing');
f.down(1,60,40);f.move(1,75,40);f.up(1);
assert.equal(f.ready,true);assert.equal(f.state,'WAITING','valid stroke distance accumulates without counting gaps');
advance(f,1.1);assert.equal(f.state,'WAITING');close(f.progress,1.1/1.7,'quiet-period progress includes the post-wave hold');
assert.equal(f.down(2,100,60),true);assert.equal(f.state,'DRAWING');assert.equal(f.elapsed,0);
f.move(2,124,60);
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
f.paused=false;assert.equal(JSON.stringify(f),snapshot,'pause freezes time and ordinary input');
f.step(100);close(f.elapsed,.55,'large frames are clamped');
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

const hold=new RevealFlow({}, {lightAwakening:true,darkAwakening:true});
hold.reset('dark');
hold.down(0,200,300);
assert.deepEqual(hold.holdFrame,{x:200,y:300,age:0,progress:0,active:false,ready:false});
advance(hold,.3);assert.equal(hold.holdFrame.active,false);
advance(hold,.06);assert.equal(hold.holdFrame.active,true,'charge appears after the contact settles');
for(let n=0;n<14;n++){hold.move(0,200+Math.sin(n)*10,300+Math.cos(n)*10);advance(hold,.05);}
assert.equal(hold.distance,0,'sub-finger jitter never adds drawing distance');
assert.equal(hold.holdFrame.ready,false);
assert.deepEqual([hold.holdFrame.x,hold.holdFrame.y],[200,300],'charge stays anchored during jitter');
advance(hold,.14);
assert.equal(hold.holdFrame.ready,true,'charge completes at 1.2 seconds');
assert.equal(hold.ready,true);
hold.paused=true;
const charged=JSON.stringify(hold);
advance(hold,10);hold.move(0,300,300);hold.up(0);
assert.equal(JSON.stringify(hold),charged,'pause freezes both charge and pointer input');
hold.paused=false;
assert.equal(hold.up(99),false,'a second pointer cannot release the charge');
assert.equal(hold.up(0),true);
assert.equal(hold.state,'RETURN');assert.equal(hold.holdFrame,null);
assert.deepEqual([hold.releasePoint.x,hold.releasePoint.y],[200,300]);
close(hold.releasePoint.age,1.2,'released charge age');
assert.equal(hold.ready,true,'completed hold remains ready during its transfer');
assert.equal(hold.down(1,100,100),false,'release transfer is not an input phase');
advance(hold,.54);assert.equal(hold.state,'RETURN');
hold.step(.03);assert.equal(hold.state,'WAITING');close(hold.elapsed,.02,'return carries fractional time into inward waves');
advance(hold,1.68);assert.equal(hold.state,'GATHER');
advance(hold,2.1);assert.equal(hold.state,'AWAKEN','hold uses the selected rare-element opening');
advance(hold,3.2);assert.equal(hold.state,'FORM');
hold.reset();
assert.equal(hold.completionSource,null);assert.equal(hold.releasePoint,null);
assert.equal(hold.holdFrame,null);assert.equal(hold.ready,false,'new rounds begin with no inherited hold');

hold.down(1,200,300);advance(hold,1);
hold.move(1,214,300);assert.ok(hold.holdFrame,'boundary jitter retains charge');
hold.move(1,215,300);assert.equal(hold.holdFrame,null,'intentional movement becomes a drawn gesture');
hold.move(1,200,300);advance(hold,2);
assert.equal(hold.holdFrame,null,'returning to the origin never changes a drawn gesture into hold');
hold.up(1);assert.equal(hold.state,'WAITING');assert.equal(hold.completionSource,'draw');
assert.equal(hold.releasePoint,null);

hold.reset();hold.down(1,10,20);advance(hold,1);
hold.up(1,{cancelled:true});advance(hold,5);
assert.equal(hold.state,'DRAWING');assert.equal(hold.ready,false);
assert.equal(hold.holdFrame,null);assert.equal(hold.releasePoint,null);
hold.down(1,10,20);advance(hold,.3);hold.up(1);
assert.equal(hold.state,'DRAWING','cancelled charge cannot carry time to another contact');
hold.down(1,10,20);advance(hold,1.3);hold.paused=true;hold.cancelPointer();
assert.equal(hold.pointerId,null);assert.equal(hold.ready,false);
hold.paused=false;hold.down(1,10,20);
assert.equal(hold.holdFrame.age,0,'lifecycle cleanup resets even a fully charged paused contact');

// A released hold has already sent energy to the center. A stray tap or blur
// during its two waves cannot require the customer to charge a second time.
hold.reset();hold.down(1,50,50);advance(hold,1.2);hold.up(1);advance(hold,.55);
const committed=hold.releasePoint;
assert.equal(hold.down(2,80,90),false);assert.equal(hold.up(2),false);hold.cancelPointer();
assert.equal(hold.completionSource,'hold');assert.equal(hold.releasePoint,committed);
assert.equal(hold.state,'WAITING');advance(hold,1.7);assert.equal(hold.state,'GATHER');
// A drawing still allows another stroke or a valid stationary charge during WAITING.
hold.reset();sketch(hold);assert.equal(hold.down(3,180,220),true);
advance(hold,1.2);hold.up(3);assert.equal(hold.completionSource,'hold');
assert.equal(hold.state,'RETURN');assert.ok(hold.distance>=24);

const slow=new RevealFlow();
slow.down(7,15,20,1000);
for(let n=1;n<=11;n++) slow.step(.1,1000+n*100);
assert.equal(slow.holdFrame.ready,false);
slow.up(7,{nowMs:2200});
assert.equal(slow.state,'RETURN','pointerup completes the final 100 ms between slow frames');
close(slow.releasePoint.age,1.2,'release uses wall time after the first contact');

slow.reset();slow.down(8,10,20,1000);slow.up(8,{nowMs:2200});
assert.equal(slow.state,'RETURN','a complete foreground hold is valid even between two frames');
slow.reset();slow.down(8,10,20);
for(let n=0;n<12;n++)slow.step(.1);
assert.equal(slow.holdFrame.ready,true,'low FPS keeps 1.2 seconds when only dt is available');

slow.reset();slow.down(9,10,20,1000);slow.step(.4,1400);
slow.paused=true;slow.paused=false;slow.step(5,6400);
close(slow.holdFrame.age,.4,'resume rebases the clock even without a paused frame');
slow.step(.5,6900);slow.up(9,{nowMs:7100});
assert.equal(slow.state,'DRAWING','time spent paused cannot complete the next release');
slow.reset();slow.down(10,10,20,1000);slow.step(.6,1600);slow.cancelPointer();
slow.down(11,10,20,9000);slow.up(11,{nowMs:9005});
assert.equal(slow.state,'DRAWING','cancelled contact time never carries to the next pointer');
// A sparse frame cadence can deliver the deadline first via RAF, movement or lift.
for(const event of ['frame','move','up']){
  slow.reset();slow.down(4,6,7,1000);slow.step(.2,1200);
  if(event==='frame')slow.step(10,11000);
  if(event==='move')slow.move(4,100,105,4000);
  if(event==='up')slow.up(4,{nowMs:4000});
  assert.equal(slow.state,'WAITING',event+' commits the hold once at its deadline');
  assert.equal(slow.completionSource,'autoHold');
  assert.deepEqual(slow.releasePoint,{x:6,y:7,age:3});
  assert.equal(slow.elapsed,0,'a slow frame keeps the entire shockwave sequence visible');
}
slow.reset();slow.down(1,20,20,1000);slow.move(1,60,60,3999);slow.step(.1,4100);slow.up(1);
assert.equal(slow.completionSource,'draw','intentional movement before the deadline takes priority');
slow.reset();slow.down(1,22,23,1000);slow.step(2.9,3900);slow.up(1,{cancelled:true,nowMs:4000});
assert.equal(slow.state,'DRAWING','system cancellation cannot synthesize a release at the deadline');
console.log('Reveal flow: draw, early release, automatic hold, cancellation, pause and reveal timing passed.');
