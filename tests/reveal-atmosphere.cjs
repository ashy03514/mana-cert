'use strict';
const assert=require('node:assert/strict');
require('../js/reveal-atmosphere.js');

const WIDTH=390,HEIGHT=844,DURATION=2.1,TAU=Math.PI*2;
const centre={x:WIDTH/2,y:HEIGHT/2};
const length=(point,origin=centre)=>Math.hypot(point.x-origin.x,point.y-origin.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const close=(a,b,message,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
function finite(point){
  for(const key of ['x','y','scale','alpha'])assert.ok(Number.isFinite(point[key]),`${key} must be finite`);
  assert.ok(point.scale>0,'render scale stays positive');
  assert.ok(point.alpha>=0&&point.alpha<=1,'alpha is paint-safe');
  return point;
}
// PortalScene emits CSS coordinates from a 390 x 600 reference ellipse.
// Use its actual shape, including the optional depth that only dots have.
function particle(index,kind,width=WIDTH,height=HEIGHT,count=64){
  const angle=index/count*TAU,rx=kind==='mist'?190:170,ry=kind==='mist'?295:260;
  return Object.freeze({x:width/2+Math.cos(angle)*rx*width/390,
    y:height/2+Math.sin(angle)*ry*height/600,angle,seed:index,
    ...(kind==='dot'?{depth:(index%11)/10}:{})});
}
function at(atmosphere,q,kind,seconds,width=WIDTH,height=HEIGHT,target={x:width/2,y:height/2}){
  atmosphere.step(0,{state:'GATHER',progress:seconds/DURATION});
  return finite(atmosphere.point(q,kind,width,height,target));
}
function velocity(atmosphere,q,kind,seconds){
  const epsilon=.0001,before=at(atmosphere,q,kind,seconds-epsilon),after=at(atmosphere,q,kind,seconds+epsilon);
  return {x:(after.x-before.x)/(epsilon*2),y:(after.y-before.y)/(epsilon*2)};
}

const atmosphere=new RevealAtmosphere();
// The half-second pressure build continues pulling mist inward, while dots
// retain their compressed orbit. Both join their actual burst start pose.
for(const kind of ['mist','dot']){
  const q=particle(9,kind);atmosphere.reset();
  let previous=length(q);
  let startRadius,lastHoldRadius;
  for(const elapsed of [.84,.9,1,1.1,1.2,1.25,1.35,1.45,1.55,1.65,1.7]){
    atmosphere.step(.05,{state:'WAITING',elapsed,progress:elapsed/1.7});
    const radius=length(atmosphere.point(q,kind,WIDTH,HEIGHT));
    assert.ok(radius<=previous+1e-8,'actual extended clock never reopens the compressed atmosphere');
    if(elapsed===1.2)startRadius=radius;
    if(elapsed>1.2){
      if(kind==='mist')assert.ok(radius<lastHoldRadius,'mist keeps moving inward throughout the half-second hold');
      else close(radius,startRadius,'dot orbit is unchanged during the mist-only pressure build');
    }
    if(elapsed>=1.2)lastHoldRadius=radius;
    previous=radius;
  }
  const held=atmosphere.point(q,kind,WIDTH,HEIGHT);
  close(length(held)/length(q),kind==='mist'?.62:.74,'mist travels an additional 12% of its source radius');
  const frozen={...held};atmosphere.step(0,{state:'WAITING',elapsed:1.7,progress:1});
  assert.deepEqual(atmosphere.point(q,kind,WIDTH,HEIGHT),frozen,'paused pressure pose never keeps integrating');
  close(distance(at(atmosphere,q,kind,0),held),0,'the held atmosphere joins the burst continuously');
  close(atmosphere.point(q,kind,WIDTH,HEIGHT).scale,held.scale,'cloud size also remains continuous at the burst');
}
for(const kind of ['mist','dot']){
  for(let i=0;i<64;i++){
    const q=particle(i,kind),copy=JSON.stringify(q);
    atmosphere.reset();
    assert.deepEqual(atmosphere.point(q,kind,WIDTH,HEIGHT),{x:q.x,y:q.y,scale:1,alpha:1},
      'ordinary drawing preserves the existing portal position and appearance');
    for(const progress of [0,.2,.5,.7]){
      atmosphere.step(1/60,{state:'WAITING',elapsed:progress*1.2,progress:progress*1.2/1.7});
      const point=atmosphere.point(q,kind,WIDTH,HEIGHT);
      close(distance(point,q),0,'the first 840 ms of waiting keeps the normal outer orbit');
    }
    let previous=length(q);
    for(let n=1;n<=18;n++){
      const elapsed=.84+.36*n/18;
      atmosphere.step(.02,{state:'WAITING',elapsed,progress:elapsed/1.7});
      const radius=length(finite(atmosphere.point(q,kind,WIDTH,HEIGHT)));
      assert.ok(radius<=previous+1e-8,'anticipation draws the outer orbit inward monotonically');
      previous=radius;
    }
    const compressed=atmosphere.point(q,kind,WIDTH,HEIGHT);
    close(length(compressed)/length(q),.74,'full anticipation contracts the existing ellipse by 26%');
    atmosphere.step(.05,{state:'WAITING',elapsed:1.7,progress:1});
    const finalCompression=atmosphere.point(q,kind,WIDTH,HEIGHT),burstStart=at(atmosphere,q,kind,0);
    close(distance(burstStart,finalCompression),0,'the burst starts at the final visible compressed orbit');
    close(burstStart.scale,finalCompression.scale,'mist size cannot pop on the first burst frame');
    close(burstStart.alpha,finalCompression.alpha,'opacity cannot pop on the first burst frame');
    assert.equal(JSON.stringify(q),copy,'choreography cannot modify the real portal pool');
  }
}

// Even a touch released before the next animation frame must use the same
// gentle release, rather than jumping when a fresh WAITING period starts.
{
  const q=particle(13,'mist');atmosphere.reset();
  atmosphere.step(0,{state:'WAITING',elapsed:1.7,progress:1});
  let last=atmosphere.point(q,'mist',WIDTH,HEIGHT);
  atmosphere.step(0,{state:'DRAWING'});
  for(let frame=1;frame<=30;frame++){
    atmosphere.step(1/60,{state:'WAITING',elapsed:frame/60,progress:frame/60/1.7});
    const next=atmosphere.point(q,'mist',WIDTH,HEIGHT);
    assert.ok(distance(next,last)<length(q)*.06,'quick re-release cannot bypass the smooth mist release');
    last=next;
  }
  assert.ok(distance(last,q)<1,'a quick re-release clears the prior inward pressure promptly');
}

// Touching again during anticipation retains the current pose, then releases
// pressure over several frames; it must not jump back to the uncompressed ring.
for(const kind of ['mist','dot']){
  const q=particle(13,kind);
  atmosphere.reset();atmosphere.step(.05,{state:'WAITING',progress:1});
  const held=atmosphere.point(q,kind,WIDTH,HEIGHT);
  atmosphere.step(0,{state:'DRAWING'});
  close(distance(held,atmosphere.point(q,kind,WIDTH,HEIGHT)),0,'resuming a stroke preserves its first frame');
  let last=held;
  for(let frame=0;frame<30;frame++){
    atmosphere.step(1/60,{state:'DRAWING'});
    const next=finite(atmosphere.point(q,kind,WIDTH,HEIGHT));
    assert.ok(length(next)>=length(last),'resuming the sketch gently restores the outer ring');
    assert.ok(distance(next,last)<length(q)*.06,'release is gradual rather than a one-frame snap');
    last=next;
  }
  assert.ok(distance(last,q)<1,'the normal drawing orbit is restored promptly');
}

for(const kind of ['mist','dot']){
  const positions=[];
  for(let i=0;i<64;i++){
    const q=particle(i,kind);
    // At 1.25 s every body has opened up and no body has begun the main pull.
    const spread=at(atmosphere,q,kind,1.25);
    positions.push(spread);
    assert.ok(length(spread)>WIDTH*.77&&length(spread)<WIDTH*1.22,
      'the outer atmosphere joins a round viewport-centred burst, not the old tall ellipse');
    assert.ok(Math.hypot(...Object.values(velocity(atmosphere,q,kind,1.25)))>5,
      'expanded particles keep drifting instead of parking at maximum spread');

    // Observe the motion, rather than inspecting the private timing formula:
    // radial expansion settles, gets a renewed outward push, then returns.
    let slowRadius=null,pushed=false,returned=false;
    for(let tick=175;tick<=380;tick++){
      const seconds=tick*.005,point=at(atmosphere,q,kind,seconds);
      const before=at(atmosphere,q,kind,seconds-.002),after=at(atmosphere,q,kind,seconds+.002);
      const radialSpeed=(length(after)-length(before))/.004;
      if(slowRadius===null&&Math.abs(radialSpeed)<.4)slowRadius=length(point);
      if(slowRadius!==null&&radialSpeed>15&&length(point)>slowRadius*1.025)pushed=true;
      if(pushed&&radialSpeed< -80)returned=true;
    }
    assert.notEqual(slowRadius,null,'the first expansion eases into a slow outer drift');
    assert.ok(pushed,'each body makes a visible second outward push before return');
    assert.ok(returned,'the extra outward push leads into the inward return');

    const materialTarget={x:WIDTH*.43,y:HEIGHT*.56};
    const end=at(atmosphere,q,kind,DURATION,WIDTH,HEIGHT,materialTarget);
    close(distance(end,materialTarget),0,'atmosphere converges on the actual material target');
    close(end.alpha,0,'collapsed atmosphere is invisible before it stacks at the centre');
    for(let seconds=0;seconds<=DURATION;seconds+=.01){
      const point=at(atmosphere,q,kind,seconds,WIDTH,HEIGHT,materialTarget);
      const distanceToTarget=length(point,materialTarget);
      if(distanceToTarget<1&&seconds>1.6){
        assert.ok(point.alpha<.035,'particles fade at the arrival point');
      }
      if(distanceToTarget>=25&&distanceToTarget<=75&&seconds>1.6){
        assert.ok(point.alpha>.9&&point.scale>.5,'the inward atmosphere stays visible until it reaches the centre');
      }
    }
  }
  const occupied=new Set(positions.map(q=>Math.floor(((Math.atan2(q.y-centre.y,q.x-centre.x)+TAU)%TAU)/TAU*12)));
  assert.equal(occupied.size,12,'the full portal pool spreads around all directions');
  const mean={x:positions.reduce((s,p)=>s+p.x,0)/positions.length,y:positions.reduce((s,p)=>s+p.y,0)/positions.length};
  assert.ok(distance(mean,centre)<WIDTH*.08,'the expanded cloud remains balanced around the screen centre');
}

// Hold origin, angle and depth fixed so variation really comes from the
// individual body, rather than the old ring or foreground geometry.
for(const kind of ['mist','dot']){
  const speeds=[],returnTimes=[];
  for(let seed=0;seed<32;seed++){
    const q=Object.freeze({...particle(0,kind),seed,depth:.5});
    const v=velocity(atmosphere,q,kind,1.25);speeds.push(Math.hypot(v.x,v.y));
    let peakRadius=0,returnTime=null;
    for(let tick=180;tick<=390;tick++){
      const seconds=tick*.005,radius=length(at(atmosphere,q,kind,seconds));
      peakRadius=Math.max(peakRadius,radius);
      if(radius<peakRadius-4){returnTime=seconds;break;}
    }
    assert.notEqual(returnTime,null,'every body eventually turns inward');returnTimes.push(returnTime);
  }
  assert.ok(Math.max(...speeds)/Math.min(...speeds)>1.35,'each body has its own drift speed');
  assert.ok(Math.max(...returnTimes)-Math.min(...returnTimes)>.08,'the pool does not turn inward as a rigid shell');
}

// Rendering is deterministic and viewport-relative. Repeated pause frames
// cannot keep integrating, and a uniformly resized screen keeps the motion.
for(const kind of ['mist','dot']){
  const q=particle(21,kind),scaled=Object.freeze({...q,x:q.x*2,y:q.y*2});
  for(const seconds of [0,.4,1.2,1.5,1.8,2.1]){
    const first=at(atmosphere,q,kind,seconds);
    assert.deepEqual(atmosphere.point(q,kind,WIDTH,HEIGHT),first,'a paused frame is exactly reproducible');
    const enlarged=at(atmosphere,scaled,kind,seconds,WIDTH*2,HEIGHT*2);
    close(enlarged.x,first.x*2,'resize scales horizontal motion');
    close(enlarged.y,first.y*2,'resize scales vertical motion');
    close(enlarged.alpha,first.alpha,'resize keeps opacity');close(enlarged.scale,first.scale,'resize keeps relative size');
    for(const [width,height] of [[844,390],[1,1],[0,0],[2560,1440]]){
      at(atmosphere,particle(21,kind,width,height),kind,seconds,width,height);
    }
  }
  for(const state of ['FORM','REVEAL','SETTLE','DONE']){
    atmosphere.step(1/60,{state,progress:.5});
    close(atmosphere.point(q,kind,WIDTH,HEIGHT).alpha,0,'the atmosphere stays hidden during the material reveal');
  }
  for(const seconds of [NaN,Infinity,-1,0,20])for(const progress of [NaN,Infinity,-1,2]){
    atmosphere.step(seconds,{state:'GATHER',progress});finite(atmosphere.point(q,kind,WIDTH,HEIGHT));
  }
  atmosphere.reset();
  assert.deepEqual(atmosphere.point(q,kind,WIDTH,HEIGHT),{x:q.x,y:q.y,scale:1,alpha:1},'replay restores the untouched portal');
}

console.log('Reveal atmosphere: anticipation, seamless burst, resumed drawing, round expansion, living drift, renewed outward push, individual speeds, target fade, pause determinism, immutable pools and resize passed.');
