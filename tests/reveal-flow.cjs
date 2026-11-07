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
f.down(1,20,40);advance(f,.2);f.up(1);
assert.equal(f.state,'WAITING','a single stationary tap starts the quiet period');
assert.deepEqual(f.lastTap,{x:20,y:40,sequence:1});assert.equal(f.tapCount,1);
advance(f,3.22);assert.equal(f.state,'GATHER','a single tap can complete the appraisal');f.reset();
assert.equal(f.down(1,20,40),true);f.move(1,44,40);f.up(1);
assert.equal(f.ready,true);assert.equal(f.state,'WAITING','a short sketch also starts the quiet period');
f.down(1,60,40);f.move(1,84,40);f.up(1);
assert.equal(f.ready,true);assert.equal(f.state,'WAITING','valid stroke distance accumulates without counting gaps');
advance(f,1.1);assert.equal(f.state,'WAITING');close(f.progress,1.1/3.22,'quiet-period progress includes the post-wave hold');
assert.equal(f.down(2,100,60),true);assert.equal(f.state,'DRAWING');assert.equal(f.elapsed,0);
f.move(2,124,60);
advance(f,2);assert.equal(f.state,'DRAWING','the contact stays interactive before the stationary deadline');
assert.equal(f.holdFrame.active,true,'a stopped drawing becomes a charge without lifting');
f.move(2,104,70);f.up(2);advance(f,3.21);
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
  sketch(f);advance(f,3.22);assert.equal(f.state,'GATHER');close(f.elapsed,0,'gather starts after the 3.22-second quiet period');
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
f.reset('water');sketch(f);advance(f,3.22);f.paused=true;f.reset('wind');
assert.equal(f.state,'DRAWING');assert.equal(f.element,'wind');assert.equal(f.paused,false);
assert.equal(f.pointerId,null);assert.equal(f.elapsed,0);assert.equal(f.materialFrame,null);
f.reset('not-an-element');assert.equal(f.element,'fire','invalid selections use a known material');

for(const [element,total] of [['fire',9.12],['water',9.12]]){
  f.reset(element);sketch(f);advance(f,total-.01);
  assert.equal(f.state,'SETTLE',element+' is not done 10 ms before its complete release-to-afterglow duration');
  advance(f,.01);assert.equal(f.state,'DONE',element+' completes at exactly '+total+' seconds');
}

// A frame that crosses a phase boundary carries its fractional time forward.
f.reset();sketch(f);advance(f,3.21);f.step(.03);
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
  sketch(formal);advance(formal,3.22);assert.equal(formal.state,'GATHER');
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
formal.reset('water');sketch(formal);advance(formal,9.82);
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
assert.equal(hold.state,'WAITING');assert.equal(hold.holdFrame,null);
assert.deepEqual([hold.releasePoint.x,hold.releasePoint.y],[200,300]);
close(hold.releasePoint.age,1.2,'released charge age');
assert.equal(hold.ready,true,'completed hold remains ready during its quiet period');
assert.equal(hold.committed,false,'a voluntary release remains open to another gesture');
advance(hold,3.21);assert.equal(hold.state,'WAITING');
hold.step(.03);assert.equal(hold.state,'GATHER');close(hold.elapsed,.02,'quiet period carries fractional time into gathering');
advance(hold,2.08);assert.equal(hold.state,'AWAKEN','hold uses the selected rare-element opening');
advance(hold,3.2);assert.equal(hold.state,'FORM');
hold.reset();
assert.equal(hold.completionSource,null);assert.equal(hold.releasePoint,null);
assert.equal(hold.holdFrame,null);assert.equal(hold.ready,false,'new rounds begin with no inherited hold');

hold.down(1,200,300);advance(hold,1);
hold.move(1,214,300);assert.ok(hold.holdFrame,'boundary jitter retains charge');
hold.move(1,240,300);assert.equal(hold.holdFrame,null,'intentional movement becomes a drawn gesture');
hold.move(1,200,300);advance(hold,2);
assert.equal(hold.holdFrame.active,true,'a stopped stroke returns to charging even at its original position');
assert.deepEqual([hold.holdFrame.x,hold.holdFrame.y],[200,300]);
hold.up(1);assert.equal(hold.state,'WAITING');assert.equal(hold.completionSource,'hold');
assert.deepEqual([hold.releasePoint.x,hold.releasePoint.y],[200,300]);
assert.equal(hold.tapCount,0,'returning to hold never turns prior ink into a tap');

hold.reset();hold.down(1,10,20);advance(hold,1);
hold.up(1,{cancelled:true});advance(hold,5);
assert.equal(hold.state,'DRAWING');assert.equal(hold.ready,false);
assert.equal(hold.holdFrame,null);assert.equal(hold.releasePoint,null);
hold.down(1,10,20);advance(hold,.3);hold.up(1);
assert.equal(hold.state,'WAITING','the next contact is evaluated independently as a tap');
assert.equal(hold.completionSource,'tap');assert.equal(hold.tapCount,1);
hold.reset();
hold.down(1,10,20);advance(hold,1.3);hold.paused=true;hold.cancelPointer();
assert.equal(hold.pointerId,null);assert.equal(hold.ready,false);
hold.paused=false;hold.down(1,10,20);
assert.equal(hold.holdFrame.age,0,'lifecycle cleanup resets even a fully charged paused contact');

// A voluntary release permits another gesture and resets the quiet period.
hold.reset();hold.down(1,50,50);advance(hold,1.2);hold.up(1);advance(hold,.55);
assert.equal(hold.down(2,80,90),true);assert.equal(hold.state,'DRAWING');assert.equal(hold.elapsed,0);
assert.equal(hold.up(2),true);assert.equal(hold.completionSource,'tap');
assert.deepEqual(hold.lastTap,{x:80,y:90,sequence:1});
assert.equal(hold.releasePoint,null);advance(hold,3.21);assert.equal(hold.state,'WAITING');
advance(hold,.01);assert.equal(hold.state,'GATHER');
// A drawing still allows another stroke or a valid stationary charge during WAITING.
hold.reset();sketch(hold);assert.equal(hold.down(3,180,220),true);
advance(hold,1.2);hold.up(3);assert.equal(hold.completionSource,'hold');
assert.equal(hold.state,'WAITING');assert.ok(hold.distance>=24);

const slow=new RevealFlow();
slow.down(7,15,20,1000);
for(let n=1;n<=11;n++) slow.step(.1,1000+n*100);
assert.equal(slow.holdFrame.ready,false);
slow.up(7,{nowMs:2200});
assert.equal(slow.state,'WAITING','pointerup completes the final 100 ms between slow frames');
close(slow.releasePoint.age,1.2,'release uses wall time after the first contact');

slow.reset();slow.down(8,10,20,1000);slow.up(8,{nowMs:2200});
assert.equal(slow.state,'WAITING','a complete foreground hold is valid even between two frames');
slow.reset();slow.down(8,10,20);
for(let n=0;n<12;n++)slow.step(.1);
assert.equal(slow.holdFrame.ready,true,'low FPS keeps 1.2 seconds when only dt is available');

slow.reset();slow.down(9,10,20,1000);slow.step(.4,1400);
slow.paused=true;slow.paused=false;slow.step(5,6400);
close(slow.holdFrame.age,.4,'resume rebases the clock even without a paused frame');
slow.step(.5,6900);slow.up(9,{nowMs:7100});
assert.equal(slow.state,'WAITING');assert.equal(slow.completionSource,'release','time spent paused cannot complete the next hold');
assert.equal(slow.releasePoint,null);assert.equal(slow.tapCount,0);
slow.reset();slow.down(10,10,20,1000);slow.step(.6,1600);slow.cancelPointer();
slow.down(11,10,20,9000);slow.up(11,{nowMs:9005});
assert.equal(slow.state,'WAITING');assert.equal(slow.completionSource,'tap','cancelled contact time never carries to the next pointer');
// A sparse frame cadence can deliver the stationary deadline via RAF or lift.
for(const event of ['frame','up']){
  slow.reset();slow.down(4,6,7,1000);slow.step(.2,1200);
  if(event==='frame')slow.step(10,11000);
  if(event==='up')slow.up(4,{nowMs:4000});
  assert.equal(slow.state,'WAITING',event+' commits the hold once at its deadline');
  assert.equal(slow.completionSource,'autoHold');
  assert.deepEqual(slow.releasePoint,{x:6,y:7,age:3});
  assert.equal(slow.elapsed,0,'a slow frame keeps the entire shockwave sequence visible');
}
slow.reset();slow.down(4,6,7,1000);slow.step(.2,1200);slow.move(4,100,105,4000);
assert.equal(slow.state,'DRAWING','new meaningful movement wins over a stale stationary deadline');
assert.equal(slow.completionSource,null);assert.equal(slow.holdFrame,null);
slow.reset();slow.down(1,20,20,1000);slow.move(1,60,60,3999);slow.step(.1,4100);slow.up(1);
assert.equal(slow.completionSource,'draw','intentional movement before the deadline takes priority');
slow.reset();slow.down(1,22,23,1000);slow.step(2.9,3900);slow.up(1,{cancelled:true,nowMs:4000});
assert.equal(slow.state,'DRAWING','system cancellation cannot synthesize a release at the deadline');

// Tap recognition is separate from accumulated drawing distance and hold energy.
const taps=new RevealFlow();
advance(taps,30);assert.equal(taps.state,'DRAWING','an untouched round cannot start itself');
taps.down(0,40,80,1000);taps.move(0,54,80,1200);taps.up(0,{nowMs:1350});
assert.deepEqual(taps.lastTap,{x:40,y:80,sequence:1},'tap jitter stays anchored at the original contact');
assert.equal(taps.distance,0);assert.equal(taps.completionSource,'tap');assert.equal(taps.ready,true);
assert.equal(Object.isFrozen(taps.lastTap),true,'the host receives an immutable tap event');
const firstTap=taps.lastTap;
assert.equal(taps.up(0),false);assert.equal(taps.up(0,{cancelled:true}),false);
assert.equal(taps.lastTap,firstTap);assert.equal(taps.tapCount,1,'late pointerup and capture cleanup cannot duplicate a star');
advance(taps,3.21);assert.equal(taps.state,'WAITING');
assert.equal(taps.down(1,140,180,4000),true);taps.up(1,{nowMs:4050});
assert.deepEqual(taps.lastTap,{x:140,y:180,sequence:2});assert.equal(taps.elapsed,0);
advance(taps,3.21);assert.equal(taps.state,'WAITING','each tap restarts the full quiet period');
sketch(taps,2);assert.equal(taps.tapCount,2);assert.equal(taps.completionSource,'draw');
assert.equal(taps.lastTap.sequence,2,'drawing never manufactures a star after earlier taps');
taps.down(3,200,300,6000);taps.up(3,{nowMs:7200});
assert.equal(taps.completionSource,'hold');assert.equal(taps.tapCount,2);
assert.ok(taps.distance>=24,'a hold retains earlier drawing distance');
assert.equal(taps.down(4,220,320,7300),true);taps.up(4,{cancelled:true,nowMs:7350});
assert.equal(taps.tapCount,2,'cancellation preserves existing stars without adding one');
advance(taps,2);assert.equal(taps.state,'DRAWING','lifecycle cancellation suspends the countdown');
taps.down(5,50,70,9000);taps.up(5,{nowMs:9351});
assert.equal(taps.completionSource,'release');assert.equal(taps.tapCount,2,'a partial hold is not a tap');
advance(taps,3.22);assert.equal(taps.state,'GATHER','even a partial hold finishes after the quiet period');
taps.reset();assert.equal(taps.lastTap,null);assert.equal(taps.tapCount,0);assert.equal(taps.ready,false);
taps.down(1,40,80,1000);taps.move(1,80,80,1100);taps.move(1,40,80,1150);taps.up(1,{nowMs:1200});
assert.equal(taps.completionSource,'draw');assert.equal(taps.tapCount,0,'an out-and-back stroke is never misclassified as a tap');
taps.down(2,60,90,2000);taps.step(.05,5000);
assert.equal(taps.committed,true);assert.equal(taps.completionSource,'autoHold');assert.equal(taps.tapCount,0);
assert.equal(taps.down(3,70,100,5100),false,'a completed automatic hold locks further gestures');
advance(taps,3.22);assert.equal(taps.state,'GATHER');

// Each fast contact gets its own jitter allowance; past drawing does not leak
// into later taps, and total jitter path length does not manufacture a stroke.
const quick=new RevealFlow();
for(let i=0;i<20;i++){
  const stamp=1000+i*180,x=60+i*9,y=170+i%3*25;
  assert.equal(quick.down(i,x,y,stamp),true);
  quick.move(i,x+22,y,stamp+20);
  quick.move(i,x-21,y,stamp+45);
  quick.move(i,x+12,y+15,stamp+65);
  quick.move(i,x+22,y+1,stamp+80,{ending:true});
  quick.up(i,{nowMs:stamp+80});
  assert.equal(quick.completionSource,'tap','quick contact '+i+' remains a tap despite fingertip jitter');
  assert.deepEqual(quick.lastTap,{x,y,sequence:i+1});
}
assert.equal(quick.distance,0);assert.equal(quick.tapCount,20);
quick.down(30,100,200,5000);quick.move(30,180,220,5040);quick.up(30,{nowMs:5080});
assert.equal(quick.completionSource,'draw','a clear fast swipe remains a drawing');
assert.equal(quick.tapCount,20);
quick.down(31,100,200,5200);quick.move(31,250,400,5280,{ending:true});quick.up(31,{nowMs:5280});
assert.equal(quick.completionSource,'tap','a release-only coordinate jump cannot begin a stroke');
assert.deepEqual(quick.lastTap,{x:100,y:200,sequence:21});
quick.down(32,100,200,5400);quick.move(32,140,200,5450);
const inkDistance=quick.distance;
assert.equal(quick.move(32,180,200,5480,{ending:true}),true,'a lift still finishes an already moving stroke');
assert.ok(quick.distance>inkDistance);quick.up(32,{nowMs:5480});
assert.equal(quick.completionSource,'draw');assert.equal(quick.tapCount,21);

// No further pointer events are required to recover from drawing into hold.
const recovery=new RevealFlow();
recovery.down(7,100,200,1000);recovery.move(7,180,240,1100);
assert.equal(recovery.holdFrame,null);
recovery.step(.34,1440);assert.equal(recovery.holdFrame,null,'brief pauses keep the active stroke');
recovery.step(.01,1450);assert.equal(recovery.holdFrame.active,true,'350 ms of stillness enters hold via RAF');
assert.deepEqual([recovery.holdFrame.x,recovery.holdFrame.y],[180,240],'charging starts at the stopped endpoint');
close(recovery.holdFrame.age,.35,'charge age uses the time since meaningful motion');
recovery.move(7,184,243,1750);recovery.step(.3,2050);
assert.deepEqual([recovery.holdFrame.x,recovery.holdFrame.y],[180,240],'small hold jitter leaves the anchor stable');
close(recovery.holdFrame.age,.95,'small hold jitter does not restart the charge');
recovery.move(7,220,280,2100);assert.equal(recovery.holdFrame,null,'resumed drawing resets the stationary charge');
recovery.step(.349,2449);assert.equal(recovery.holdFrame,null);
recovery.step(.001,2450);assert.equal(recovery.holdFrame.active,true);
assert.deepEqual([recovery.holdFrame.x,recovery.holdFrame.y],[220,280]);
recovery.move(99,400,500,2600);recovery.up(99,{nowMs:2700});
assert.equal(recovery.pointerId,7,'a second finger cannot move or release the active charge');
recovery.step(.05,5099);assert.equal(recovery.state,'DRAWING');
recovery.step(.001,5100);assert.equal(recovery.completionSource,'autoHold');
assert.deepEqual(recovery.releasePoint,{x:220,y:280,age:3});
assert.equal(recovery.tapCount,0,'drawing-to-hold automatic completion cannot create a star');

// Slow movement accumulates against a fixed quiet anchor, rather than treating
// each tiny successive step as stationary. Repeated bounded jitter may charge.
const drift=new RevealFlow();
drift.down(1,100,200,1000);drift.move(1,140,200,1100);
for(let i=1;i<=80;i++){
  const now=1100+i*100;
  drift.move(1,140+i*4,200,now);drift.step(.1,now);
  assert.equal(drift.state,'DRAWING');assert.equal(drift.holdFrame,null,'continuous slow drift never becomes a hold');
}
drift.up(1,{nowMs:9100});assert.equal(drift.completionSource,'draw');
const partial=new RevealFlow();
partial.down(1,30,40,1000);partial.move(1,90,80,1050);partial.step(.4,1450);partial.up(1,{nowMs:1450});
assert.equal(partial.completionSource,'release','a short recovered hold is not confused with a new tap');
assert.equal(partial.tapCount,0);
partial.reset();partial.down(1,30,40,1000);partial.move(1,90,80,1100);partial.step(.4,1500);
partial.paused=true;partial.paused=false;partial.step(5,6500);
close(partial.holdFrame.age,.4,'background time cannot complete a recovered hold');
partial.up(1,{cancelled:true,nowMs:9500});
assert.equal(partial.state,'DRAWING');assert.equal(partial.tapCount,0);assert.equal(partial.holdFrame,null);
partial.reset();partial.down(1,30,40,1000);partial.move(1,90,80,1100);partial.step(1.3,2400);
assert.equal(partial.move(1,180,160,2450,{ending:true}),false,'lifting cannot break a recovered stationary hold');
partial.up(1,{nowMs:2450});
assert.equal(partial.completionSource,'hold');assert.deepEqual([partial.releasePoint.x,partial.releasePoint.y],[90,80]);
assert.equal(partial.tapCount,0);
console.log('Reveal flow: jitter-safe taps, recoverable draw/hold modes, quiet clocks, mixed gestures, cancellation, pause and reveal timing passed.');
