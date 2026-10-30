'use strict';
const assert=require('node:assert/strict');
require('../js/reveal-flow.js');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
function advance(flow,seconds){
  let left=seconds;
  while(left>1e-9){const step=Math.min(.05,left);flow.step(step);left-=step;}
}
function sketch(flow){assert.equal(flow.down(1,20,30),true);assert.equal(flow.move(1,55,30),true);assert.equal(flow.up(1),true);}
function enterGather(flow){sketch(flow);advance(flow,1.7);assert.equal(flow.state,'GATHER');}

// Opting in must not change basic elements, dark, or muggle timing. Light is
// also unchanged unless the host explicitly enables this opening.
for(const element of ['fire','water','wind','earth','dark',null]){
  for(const enabled of [false,true]){
    const flow=new RevealFlow({}, {lightAwakening:enabled});flow.reset(element);
    assert.equal(flow.awakeningEnabled,false);assert.equal(flow.awakeningDuration,0);
    const duration=element==='fire'||element==='water'?1.2:.8;
    assert.equal(flow.formationDuration,duration);enterGather(flow);advance(flow,2.1);
    assert.equal(flow.state,'FORM');assert.equal(flow.materialFrame.time,0);
    advance(flow,duration);assert.equal(flow.state,'REVEAL');close(flow.materialFrame.time,duration,'normal material clock');
  }
}
const oldLight=new RevealFlow();oldLight.reset('light');enterGather(oldLight);advance(oldLight,2.1);
assert.equal(oldLight.state,'FORM');assert.equal(oldLight.formationDuration,.8);

const light=new RevealFlow({}, {holdAtReveal:true,lightAwakening:true});light.reset('light');
assert.equal(light.awakeningEnabled,true);assert.equal(light.awakeningDuration,1.9);assert.equal(light.formationDuration,.6);
enterGather(light);advance(light,2.09);assert.equal(light.state,'GATHER');assert.equal(light.materialFrame,null);
advance(light,.01);assert.equal(light.state,'AWAKEN');assert.equal(light.duration,1.9);close(light.elapsed,0,'awakening starts fresh');
assert.equal(light.materialFrame,null);assert.equal(light.progress,0);assert.equal(light.down(2,50,50),false);
advance(light,.4);close(light.elapsed,.4,'condensation clock');assert.equal(light.materialFrame,null);
advance(light,.7);close(light.elapsed,1.1,'light shafts clock');assert.equal(light.materialFrame,null);
light.paused=true;const frozen=JSON.stringify(light);advance(light,10);assert.equal(JSON.stringify(light),frozen);
light.cancelPointer();assert.equal(light.state,'AWAKEN');close(light.elapsed,1.1,'lifecycle cleanup retains reveal');
light.paused=false;advance(light,.79);assert.equal(light.state,'AWAKEN');assert.equal(light.materialFrame,null);
advance(light,.01);assert.equal(light.state,'FORM');
for(const key of ['time','phase','opacity'])close(light.materialFrame[key],0,'formation starts at zero '+key);
advance(light,.3);close(light.materialFrame.time,.3,'material starts after awakening');close(light.materialFrame.opacity,.5,'soft wing reveal');
advance(light,.3);assert.equal(light.state,'REVEAL');close(light.elapsed,0,'numeric reveal clock starts fresh');close(light.materialFrame.time,.6,'light form duration');
advance(light,20);assert.equal(light.state,'REVEAL');close(light.elapsed,20,'held final animation stays alive');close(light.materialFrame.time,20.6,'held material clock');

// A frame crossing a state boundary carries only its remainder forward.
light.reset('light');enterGather(light);advance(light,2.08);light.step(.05);
assert.equal(light.state,'AWAKEN');close(light.elapsed,.03,'gather remainder');
advance(light,1.84);light.step(.05);assert.equal(light.state,'FORM');close(light.elapsed,.02,'awakening remainder');
advance(light,.55);light.step(.05);assert.equal(light.state,'REVEAL');close(light.elapsed,.02,'formation remainder');

light.reset('light');assert.equal(light.state,'DRAWING');assert.equal(light.elapsed,0);assert.equal(light.paused,false);assert.equal(light.materialFrame,null);
assert.equal(light.awakeningEnabled,true,'replay preserves configured opening');
light.down(1,0,0);light.move(1,30,0);light.up(1,{cancelled:true});advance(light,10);assert.equal(light.state,'DRAWING','cancel never starts awakening');
light.configure({}, {lightAwakening:false});light.reset('light');enterGather(light);advance(light,2.1);assert.equal(light.state,'FORM');assert.equal(light.formationDuration,.8);
light.configure({}, {lightAwakening:true});light.reset('light');enterGather(light);advance(light,2.1+1.9+.6+1.8+.8);assert.equal(light.state,'DONE','non-held preview completes');
assert.equal(light.progress,1);close(light.materialFrame.time,3.2,'completed material clock excludes awakening');
console.log('PASS light awakening flow: opt-in light-only opening, 1.9s awakening + .6s formation, unchanged basic/dark/muggle pacing, held clocks, no early material, pause/replay/cancel and frame remainders.');
