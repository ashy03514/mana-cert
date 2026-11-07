const assert = require('node:assert/strict');
const path = require('node:path');

const repository = process.env.MANA_REPO || path.resolve(__dirname, '..');
require(path.join(repository, 'js/reveal-flow.js'));
require('../js/interaction-prompt.js');

const {Model, copy} = globalThis.InteractionPrompt;
let checks = 0;
const test = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const close = (actual, expected, name) => assert.ok(Math.abs(actual-expected)<1e-8, `${name}: ${actual} vs ${expected}`);

function fixture(element='fire', settings={}, options={}) {
  const flow = new RevealFlow(settings, options).reset(element);
  const model = new Model();
  return {flow, model};
}
function observe(model, flow, dt) {
  const original = JSON.stringify(flow);
  model.step(dt, flow);
  assert.equal(JSON.stringify(flow), original, 'status observation must never mutate the reveal flow');
}
function advance(pair, seconds, frames) {
  let remaining = seconds;
  while (remaining>1e-9) {
    const dt=Math.min(.01, remaining);
    pair.flow.step(dt);
    observe(pair.model, pair.flow, dt);
    frames?.push({state:pair.flow.state,...pair.model.frame()});
    remaining-=dt;
  }
}
function touch(pair, guide='請按照你的方法觸碰儀器', id=1) {
  assert.equal(pair.flow.down(id, 120, 200), true);
  pair.model.start(guide);
}
function sketch(pair, id=1) {
  touch(pair, '', id);
  pair.flow.move(id, 160, 200);
  pair.flow.up(id);
}
function continueDrawing(pair,id,seconds,frames) {
  let time=0,index=0;
  while(time<seconds-1e-9){
    pair.flow.move(id,190+(index%2)*24,220);
    const dt=Math.min(.1,seconds-time);advance(pair,dt,frames);
    time+=dt;index++;
  }
}

test('guide crossfades on accepted first touch without replacing saved copy', () => {
  const pair=fixture();
  const guide='第一行\n第二行';
  touch(pair, guide);
  assert.equal(pair.model.frame().previous, guide);
  assert.equal(pair.model.frame().previousGuide, true);
  assert.equal(pair.model.frame().mix, 0);
  advance(pair, .25);
  close(pair.model.frame().mix, 1, 'guide finishes fade');
  assert.equal(pair.model.frame().key, 'sensed');
  assert.equal(pair.model.frame().text, copy.sensed);
  advance(pair, .54);
  assert.equal(pair.model.frame().key, 'sensed', 'first status remains for minimum dwell');
  advance(pair, .01);
  assert.equal(pair.model.frame().key, 'holding');
  assert.equal(guide, '第一行\n第二行');
});

test('editable drawing WAITING never claims resonance and continuation stays editable', () => {
  const pair=fixture();
  sketch(pair);
  const frames=[];
  advance(pair, 3.12, frames);
  assert.equal(pair.flow.state, 'WAITING');
  assert.equal(pair.model.frame().key, 'drawing');
  assert.ok(frames.every(frame=>!['resonance','gathering'].includes(frame.key)));
  const before=pair.model.frame();
  touch(pair, '', 2);
  assert.deepEqual(pair.model.frame(), before, 'continuing a round does not replay the initial guide');
  pair.flow.move(2, 190, 220);
  continueDrawing(pair, 2, .9, frames);
  assert.equal(pair.flow.state, 'DRAWING');
  assert.equal(pair.model.frame().key, 'drawing');
  pair.flow.up(2);
  advance(pair, 3.21, frames);
  assert.equal(pair.flow.state, 'WAITING');
  assert.equal(pair.model.frame().key, 'drawing');
  advance(pair, .01);
  assert.equal(pair.flow.state, 'GATHER');
  assert.equal(pair.model.frame().key, 'resonance');
  advance(pair, .79);
  assert.equal(pair.model.frame().key, 'resonance');
  advance(pair, .02); // Permit one presentation frame after the minimum dwell.
  assert.equal(pair.model.frame().key, 'gathering');
});

test('manual hold release remains editable until the quiet period completes', () => {
  const pair=fixture();
  touch(pair);
  advance(pair, 1.2);
  assert.equal(pair.model.frame().key, 'holding');
  assert.equal(pair.flow.up(1), true);
  assert.equal(pair.flow.state, 'WAITING');
  assert.equal(pair.flow.heldRelease, true);
  const frames=[];
  advance(pair, 3.12, frames);
  assert.equal(pair.model.frame().key, 'holding');
  assert.equal(pair.model.committed, false);
  advance(pair, .1, frames);
  assert.equal(pair.flow.state, 'GATHER');
  assert.equal(pair.flow.completionSource, 'hold');
  advance(pair, .81, frames);
  assert.ok(frames.some(frame=>frame.key==='resonance'));
  assert.ok(frames.some(frame=>frame.key==='gathering'));
  const promotions=frames.filter((frame,i)=>frame.key==='resonance' && frames[i-1]?.key!=='resonance');
  assert.equal(promotions.length, 1);
});

test('stationary auto completion cannot regress after late pointer cleanup', () => {
  const pair=fixture();
  touch(pair);
  advance(pair, 3);
  assert.equal(pair.flow.state, 'WAITING');
  assert.equal(pair.flow.completionSource, 'autoHold');
  assert.equal(pair.model.frame().key, 'resonance');
  pair.flow.cancelPointer();
  assert.equal(pair.flow.down(2, 100, 100), false);
  advance(pair, .81);
  assert.equal(pair.model.frame().key, 'gathering');
  advance(pair, .89);
  assert.equal(pair.flow.state, 'GATHER');
  assert.equal(pair.model.frame().key, 'gathering');
});

test('moving out of a hold changes to parsing and preserves the drawing interaction', () => {
  const pair=fixture();
  touch(pair);
  advance(pair, .9);
  assert.equal(pair.model.frame().key, 'holding');
  pair.flow.move(1, 160, 200);
  assert.equal(pair.flow.holdFrame, null);
  continueDrawing(pair, 1, 2.2);
  assert.equal(pair.flow.state, 'DRAWING');
  assert.equal(pair.model.frame().key, 'drawing');
  assert.equal(pair.model.committed, false);
});

test('stopping a stroke changes the status back to charging without lifting', () => {
  const pair=fixture();touch(pair);pair.flow.move(1,190,220);
  continueDrawing(pair,1,.9);
  assert.equal(pair.model.frame().key,'drawing');
  advance(pair,.9);
  assert.equal(pair.flow.holdFrame.active,true);
  assert.equal(pair.model.frame().key,'holding');
  assert.equal(pair.model.committed,false);
  pair.flow.move(1,300,300);continueDrawing(pair,1,.9);
  assert.equal(pair.flow.holdFrame,null);
  assert.equal(pair.model.frame().key,'drawing','moving again restores parsing after the status dwell');
  advance(pair,3);
  assert.equal(pair.flow.completionSource,'autoHold');
  assert.equal(pair.model.frame().key,'resonance');
  assert.equal(pair.flow.tapCount,0);
});

test('taps announce connected stars and cancellation fades without success', () => {
  const tapped=fixture();
  touch(tapped);advance(tapped,.1);tapped.flow.up(1);advance(tapped,.9);
  assert.equal(tapped.flow.state,'WAITING');
  assert.equal(tapped.model.frame().key,'stars');
  assert.equal(tapped.model.committed,false);
  touch(tapped,'',2);advance(tapped,.1);tapped.flow.up(2);advance(tapped,3.22);
  assert.equal(tapped.flow.state,'GATHER');
  assert.equal(tapped.model.frame().key,'resonance');
  for (const cancellation of [true]) {
    const pair=fixture();
    touch(pair);
    advance(pair, cancellation?.95:.1);
    pair.flow.up(1, {cancelled:cancellation});
    const frames=[];
    advance(pair, 2, frames);
    assert.equal(pair.flow.state, 'DRAWING');
    assert.equal(pair.model.frame().active, false);
    assert.ok(frames.every(frame=>!['resonance','gathering'].includes(frame.key)));
    touch(pair, '', 2);
    assert.equal(pair.model.frame().key, 'sensed');
  }
});

test('pause freezes the model, invalid frames do nothing, reset clears stale messages', () => {
  const pair=fixture();
  touch(pair);
  advance(pair, .95);
  pair.flow.paused=true;
  const frozen=JSON.stringify(pair.model);
  for (const dt of [0,.05,10,-1,NaN,Infinity]) observe(pair.model,pair.flow,dt);
  assert.equal(JSON.stringify(pair.model), frozen);
  pair.flow.paused=false;
  for (const dt of [-1,NaN,Infinity]) observe(pair.model,pair.flow,dt);
  assert.equal(JSON.stringify(pair.model), frozen);
  const clock=pair.model.time;
  observe(pair.model,pair.flow,100);
  close(pair.model.time-clock,.05,'frame cap');
  pair.model.reset();
  pair.flow.reset();
  assert.equal(pair.model.frame().active,false);
  assert.equal(pair.model.frame().previous,'');
  assert.equal(pair.model.committed,false);
  advance(pair,1);
  assert.equal(pair.model.frame().active,false,'never starts without accepted touch');
});

test('base, rare and muggle paths hide before revealing without changing reveal timing', () => {
  for (const element of ['fire','water','wind','earth','lightning','light','dark',null]) {
    for (const duration of [1.2,2.1,4]) {
      const pair=fixture(element,{burstDuration:duration},{lightAwakening:true,darkAwakening:true,holdAtReveal:true});
      sketch(pair);
      advance(pair,3.22);
      assert.equal(pair.flow.state,'GATHER');
      const frames=[];
      advance(pair,duration-.1,frames);
      assert.ok(pair.model.frame().opacity<1,'prompt fades before the gather ends');
      advance(pair,.1,frames);
      assert.equal(pair.flow.state,['light','dark'].includes(element)?'AWAKEN':'FORM');
      assert.equal(pair.model.frame().active,false,'opening or material has exclusive foreground');
      assert.ok(frames.some(frame=>frame.key==='gathering'));
      advance(pair,8);
      assert.equal(pair.flow.state,'REVEAL');
      assert.equal(pair.model.frame().active,false);
    }
  }
});

console.log(`interaction-prompt: ${checks} lifecycle scenarios passed`);
