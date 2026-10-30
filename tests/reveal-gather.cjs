'use strict';
const assert=require('node:assert/strict');
require('../js/ribbon-renderer.js');
require('../js/reveal-gather.js');

function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}
function finite(values,label){
  for(const value of values)if(typeof value==='number'){
    assert.ok(Number.isFinite(value),`${label} must stay finite: ${value}`);
  }
}
function style(value){
  if(typeof value==='string'){
    assert.ok(!/NaN|Infinity/.test(value),'paint styles cannot contain invalid numbers');
    const rgba=/^rgba\(([^)]+)\)$/.exec(value);
    if(rgba){
      const channels=rgba[1].split(',').map(Number);
      finite(channels,'color channel');
      assert.ok(channels.slice(0,3).every(n=>n>=0&&n<=255));
      assert.ok(channels[3]>=0&&channels[3]<=1);
    }
  }
}
function canvas(record=false){
  const events=[],stack=[];
  let state={globalAlpha:.73,globalCompositeOperation:'source-over',lineWidth:1,
    lineCap:'butt',lineJoin:'miter',fillStyle:'#123456',strokeStyle:'#654321'};
  const initial={...state};
  const event=(name,args=[])=>{
    finite(args,name);
    if(record)events.push([name,...args]);
  };
  const c={
    events,
    save(){stack.push({...state});event('save');},
    restore(){assert.ok(stack.length,'restore must have a matching save');state=stack.pop();event('restore');},
    createRadialGradient(...args){
      event('gradient',args);
      assert.ok(args[2]>=0&&args[5]>0,'radial gradients need valid radii');
      return {addColorStop(offset,color){
        assert.ok(Number.isFinite(offset)&&offset>=0&&offset<=1);
        style(color);event('stop',[offset,color]);
      }};
    },
    createLinearGradient(...args){
      assert.equal(args.length,4,'linear gradients receive both endpoints');
      event('linear-gradient',args);
      return {addColorStop(offset,color){
        assert.ok(Number.isFinite(offset)&&offset>=0&&offset<=1);
        style(color);event('stop',[offset,color]);
      }};
    },
    finish(){
      assert.equal(stack.length,0,'draw balances canvas save/restore');
      assert.deepEqual(state,initial,'draw restores caller canvas state');
      return events;
    }
  };
  for(const method of ['fillRect','beginPath','moveTo','lineTo','quadraticCurveTo','stroke','fill','closePath']){
    c[method]=(...args)=>event(method,args);
  }
  c.arc=(...args)=>{event('arc',args);assert.ok(args[2]>=0);};
  for(const key of Object.keys(state))Object.defineProperty(c,key,{
    get(){return state[key];},
    set(value){
      if(key==='globalAlpha')assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
      if(key==='lineWidth')assert.ok(Number.isFinite(value)&&value>0);
      if(key==='globalCompositeOperation')assert.equal(value,'source-over','gather avoids additive overexposure');
      if(key.endsWith('Style'))style(value);
      state[key]=value;
      event(key,[typeof value==='object'?'gradient':value]);
    }
  });
  return c;
}
function trails(strokes,settings={}){
  return {
    width:390,height:844,time:14.2,
    settings:{trailEnabled:true,trailOpacity:85,...settings},
    renderer:new RibbonRenderer({color:'#7deaff',width:1.2,glowSize:.9}),
    strokes,
    opacity(stroke){return stroke.opacity??1;}
  };
}
function stroke(seed,count=72){
  return {
    seed,color:seed%2?'#ac82f3':'#7deaff',released:13.8,opacity:.8,
    points:Array.from({length:count},(_,i)=>{
      const phase=i/(count-1)*Math.PI*3.2;
      return {x:195+Math.cos(phase)*80,y:180+i/(count-1)*430,speed:.3};
    })
  };
}
function render(gather,frame={},record=false){
  const c=canvas(record);
  gather.draw(c,{target:{x:gather.width/2,y:gather.height*.52},...frame});
  return c.finish();
}

// A production RibbonRenderer normally adds caches to strokes. Capture must
// build its own copies, even when the live drawing has no cache yet.
const source=trails([stroke(2),stroke(3)]);
source.renderer.route(source.strokes[0]);
const before=JSON.stringify(source),sourceOptions=JSON.stringify(source.renderer.options);
freeze(source);
const gather=new RevealGather();
gather.capture(source,390,844);
assert.equal(JSON.stringify(source),before,'capture cannot mutate source points or geometry caches');
assert.equal(JSON.stringify(source.renderer.options),sourceOptions);
assert.ok(gather.pointCount>0&&gather.moteCount>0);
assert.ok(Object.isFrozen(gather.routes)&&Object.isFrozen(gather.orbs));
for(const route of gather.routes){
  assert.ok(Object.isFrozen(route)&&Object.isFrozen(route.points)&&Object.isFrozen(route.color));
  assert.ok(route.points.every(Object.isFrozen),'snapshot points must be immutable');
}
assert.ok(gather.orbs.every(Object.isFrozen),'orb seeds are an immutable snapshot');
assert.throws(()=>{gather.routes[0].points[0].x=999;},TypeError);
assert.throws(()=>{gather.orbs[0].depth=100;},TypeError);
assert.throws(()=>{gather.routes.push({});},TypeError);

const mutable=trails([stroke(7)]);
const separate=new RevealGather();separate.capture(mutable,390,844);
const independent=JSON.stringify([separate.routes,separate.orbs]);
mutable.strokes[0].points[0].x=12345;
mutable.strokes[0].color='#ff0000';
mutable.renderer.options.width=7;
assert.equal(JSON.stringify([separate.routes,separate.orbs]),independent,'later drawing edits do not alter the snapshot');
assert.equal(separate.options.width,1.2,'renderer settings are copied');

// Long, multi-stroke input cannot grow render resources without bound.
const busy=trails(Array.from({length:48},(_,i)=>({
  ...stroke(i,160),
  points:Array.from({length:160},(_,j)=>({x:j%2?380:10,y:20+(j*79)%804,speed:.5}))
})));
const bounded=new RevealGather();bounded.capture(busy,390,844);
assert.ok(bounded.pointCount<=1600,'snapshot has at most 1600 sampled points');
assert.ok(bounded.moteCount<=180,'snapshot has at most 180 orbs');
assert.equal(bounded.pointCount,bounded.routes.reduce((n,r)=>n+r.points.length,0));
assert.equal(bounded.moteCount,bounded.orbs.length);
assert.ok(bounded.moteCount>80,'a substantial drawing retains a visible cloud');
for(const orb of bounded.orbs){
  finite(Object.values(orb),'orb seed');
  assert.ok(orb.depth>=-1&&orb.depth<=1);
  assert.ok(bounded.routes[orb.route],'each orb keeps a valid source route');
}

// Repeat the same animation frame after rendering other progress values.
// A paused frame must not depend on draw-call history or result randomness.
const snapshot=JSON.stringify([gather.routes,gather.orbs]);
const random=Math.random;Math.random=()=>{throw Error('visual drawing must not consume result randomness');};
try{
  for(const element of ['fire','water','wind','earth','light','dark']){
    for(const progress of [0,.025,.1,.35,2/3,.83,.97,1]){
      const frame={progress,element,time:1.7};
      const first=render(gather,frame,true);
      render(gather,{progress:.45,element:'dark',time:9.2});
      assert.deepEqual(render(gather,frame,true),first,'same progress and clock produce the same paused frame');
    }
  }
  for(const progress of [-1,NaN,Infinity,0,.05,.1,.4,2/3,.8,.96,1,2]){
    render(bounded,{progress,time:NaN,target:{x:NaN,y:Infinity},element:'unknown'});
  }
  for(const formation of [NaN,-1,0,.1,.39,.4,1]){
    render(gather,{progress:1,formation,time:2});
  }
}finally{Math.random=random;}
assert.equal(JSON.stringify([gather.routes,gather.orbs]),snapshot,'drawing must not modify its immutable snapshot');
assert.equal(JSON.stringify(source),before,'drawing must not modify captured live sources');

// Resize changes pixel projection, not normalized source geometry.
const orb=gather.orbs[0];
gather.resize(780,1688);
const center={x:390,y:844};
const projected=gather.position(gather.orbit(orb,center,1.6),0,center);
assert.ok(Math.abs(projected.x-orb.x*780)<1e-8&&Math.abs(projected.y-orb.y*1688)<1e-8);
assert.equal(JSON.stringify([gather.routes,gather.orbs]),snapshot);
for(const size of [[1,1],[844,390],[390,844],[NaN,900],[-1,0]]){
  const previous=[gather.width,gather.height];
  gather.resize(...size);
  if(size.some(n=>!Number.isFinite(n)||n<=0))assert.deepEqual([gather.width,gather.height],previous);
  for(const progress of [0,.04,.5,.85,1])render(gather,{progress,time:.3});
}

for(const data of [null,trails([]),trails([stroke(1)],{trailEnabled:false}),
  trails([{seed:1,color:'#ffffff',points:[{x:NaN,y:9}]}]),
  trails([{...stroke(1),opacity:0}])]){
  const empty=new RevealGather();empty.capture(data,390,844);
  assert.equal(empty.pointCount,0);assert.equal(empty.moteCount,0);
  assert.deepEqual(render(empty,{},true),[],'empty or invisible input paints nothing');
}
for(const points of [[{x:195,y:422}],Array.from({length:4},()=>({x:195,y:422}))]){
  const single=new RevealGather();single.capture(trails([{seed:0,color:'#bad',points}]),390,844);
  assert.equal(single.pointCount,1,'stationary input stays a single source sample');
  assert.ok(single.moteCount>0&&single.moteCount<=180);
  for(const progress of [0,.025,.1,.5,.85,1])render(single,{progress,time:.2});
}
const savedRenderer=globalThis.RibbonRenderer;
const fallbackInput=trails([stroke(1)]);
try{
  delete globalThis.RibbonRenderer;
  const fallback=new RevealGather();fallback.capture(fallbackInput,390,844);
  assert.ok(fallback.pointCount>0&&fallback.moteCount>0,'snapshot supports a missing optional ribbon renderer');
  for(const progress of [0,.1,.5,.9,1])render(fallback,{progress});
}finally{globalThis.RibbonRenderer=savedRenderer;}

// The expanded cloud must fill a circular field even when the source drawing
// is a line, and its centre must not inherit a material's formation offset.
const duration=2.1,expandedMoment=1.25/duration;
const shapes={
  horizontal:Array.from({length:70},(_,i)=>({x:25+i*340/69,y:422})),
  vertical:Array.from({length:70},(_,i)=>({x:195,y:120+i*600/69})),
  scribble:Array.from({length:180},(_,i)=>({
    x:195+Math.sin(i*.27)*155,y:422+Math.cos(i*.19)*280
  }))
};
function cloudFor(points){
  const cloud=new RevealGather();
  cloud.capture(trails([{seed:13,color:'#7deaff',points}]),390,844);
  return cloud;
}
const screenCenter={x:195,y:422},materialOrigin={x:195,y:510};
for(const [name,points] of Object.entries(shapes)){
  const cloud=cloudFor(points);
  assert.ok(cloud.moteCount>=72&&cloud.moteCount<=180,`${name}: a simple line still creates a full cloud`);
  const endpoints=cloud.orbs.map(body=>{
    const path=cloud.orbit(body,screenCenter,1);
    const p=cloud.position(path,expandedMoment,screenCenter);
    const otherPath=cloud.orbit(body,materialOrigin,1);
    const other=cloud.position(otherPath,expandedMoment,materialOrigin);
    assert.ok(Math.hypot(p.x-other.x,p.y-other.y)<1e-7,
      `${name}: explosion placement is independent of the material origin`);
    const first=cloud.position(path,0,screenCenter);
    assert.ok(Math.hypot(first.x-body.x*390,first.y-body.y*844)<1e-7,
      `${name}: orb conversion starts at the user's actual drawing`);
    const finish=cloud.position(otherPath,1,materialOrigin);
    assert.ok(Math.hypot(finish.x-materialOrigin.x,finish.y-materialOrigin.y)<1e-7,
      `${name}: return still reaches the material's own origin`);
    return {x:p.x-screenCenter.x,y:p.y-screenCenter.y};
  });
  const sectors=Array(12).fill(0),radii=endpoints.map(p=>Math.hypot(p.x,p.y));
  for(const p of endpoints){
    const angle=(Math.atan2(p.y,p.x)+Math.PI*2)%(Math.PI*2);
    sectors[Math.floor(angle/(Math.PI*2)*sectors.length)]++;
  }
  assert.ok(sectors.every(n=>n>=2),`${name}: all 12 directions have visible orbs, received ${sectors}`);
  const meanX=endpoints.reduce((s,p)=>s+p.x,0)/endpoints.length;
  const meanY=endpoints.reduce((s,p)=>s+p.y,0)/endpoints.length;
  const radiusMean=radii.reduce((s,r)=>s+r,0)/radii.length;
  assert.ok(Math.hypot(meanX,meanY)<radiusMean*.15,`${name}: cloud stays centred on the viewport`);
  const xx=endpoints.reduce((s,p)=>s+p.x*p.x,0)/endpoints.length;
  const yy=endpoints.reduce((s,p)=>s+p.y*p.y,0)/endpoints.length;
  const xy=endpoints.reduce((s,p)=>s+p.x*p.y,0)/endpoints.length;
  const variance=Math.sqrt((xx-yy)**2+4*xy*xy),trace=xx+yy;
  assert.ok(Math.sqrt((trace+variance)/(trace-variance))<1.35,
    `${name}: the cloud remains approximately round, not a horizontal, vertical or diagonal band`);
  assert.ok(radiusMean>195*.9&&Math.max(...radii)>390*.8,
    `${name}: the outward field is large enough to spill beyond the phone's sides`);
  assert.ok(endpoints.some(p=>p.x < -195)&&endpoints.some(p=>p.x>195),
    `${name}: off-screen orbs are allowed instead of clamping to a rectangle`);
}

// Measure visible motion rather than requiring a specific polynomial. Each
// orb's own phase boundaries must keep travelling while the radial burst slows,
// give one extra outward push, and then flow continuously into the return.
const motion=cloudFor(shapes.scribble),positions=[];
function speed(at,start,end){
  let last=at(start),distance=0;
  const count=Math.max(1,Math.ceil((end-start)/.001)),dt=(end-start)/count;
  for(let i=1;i<=count;i++){
    const p=at(start+dt*i);distance+=Math.hypot(p.x-last.x,p.y-last.y);last=p;
  }
  return distance/(end-start);
}
function velocity(at,seconds,dt=.0002){
  const a=at(seconds-dt),b=at(seconds+dt);
  return {x:(b.x-a.x)/(2*dt),y:(b.y-a.y)/(2*dt)};
}
function radius(p){return Math.hypot(p.x-screenCenter.x,p.y-screenCenter.y);}
for(const depth of [-.8,0,.8]){
  // A centre-to-field journey measures the speed envelope consistently. A
  // source already beside its destination has little radial distance to cover.
  const body={...motion.orbs[8],x:.5,y:.5,depth};
  const path=motion.orbit(body,materialOrigin,1);
  const at=seconds=>motion.position(path,seconds/duration,materialOrigin);
  const burstEnd=path.burstEnd*duration,nudgeAt=path.nudgeAt*duration,pullAt=path.pullAt*duration;
  const opening=speed(at,0,.04),expansion=speed(at,.15,.45),slow=speed(at,burstEnd,nudgeAt);
  assert.ok(opening<expansion*.6,'orbs ease into expansion instead of jumping to full speed on the first frame');
  assert.ok(expansion>slow*3,'outward expansion gradually settles into slow motion');
  assert.ok(slow>5,'an expanded orb continues visibly drifting instead of freezing at maximum spread');
  assert.ok(Math.hypot(at(nudgeAt).x-at(burstEnd).x,at(nudgeAt).y-at(burstEnd).y)>1,
    'the slow section moves far enough to remain visible on the phone');
  assert.ok(radius(at(pullAt))>radius(at(nudgeAt))*1.05,
    'the sphere moves farther outward before beginning its inward return');
  const returning=speed(at,pullAt+(path.end*duration-pullAt)*.45,path.end*duration-.03);
  assert.ok(returning>slow*5,'return gathers speed after the drifting moment');
  const velocities=Array.from({length:Math.floor(pullAt/.02)},(_,i)=>speed(at,i*.02,(i+1)*.02));
  const maxSpeed=Math.max(...velocities);
  const largestJump=Math.max(...velocities.slice(1).map((v,i)=>Math.abs(v-velocities[i])));
  assert.ok(largestJump<maxSpeed*.2,'adjacent outward frames have a smooth speed curve');
  for(const join of [burstEnd,nudgeAt,pullAt]){
    const beforeJoin=velocity(at,join-.0005),afterJoin=velocity(at,join+.0005);
    assert.ok(Math.hypot(beforeJoin.x-afterJoin.x,beforeJoin.y-afterJoin.y)<maxSpeed*.02,
      'radial slowdown, extra outward push and inward pull join without a velocity snap');
    assert.ok(Math.min(Math.hypot(beforeJoin.x,beforeJoin.y),Math.hypot(afterJoin.x,afterJoin.y))>5,
      'the orb keeps drifting across every handoff instead of stopping between phases');
  }
  const finish=at(duration);
  assert.ok(Math.hypot(finish.x-materialOrigin.x,finish.y-materialOrigin.y)<1e-8);
  assert.ok(finish.alpha<.01,'orbs fade before stacking into an opaque central spot');
  positions.push(at(burstEnd));
}
assert.ok(positions[0].perspective<positions[1].perspective&&
  positions[1].perspective<positions[2].perspective,'foreground orbs project larger than background orbs');
const bodies=[];
const originalBall=motion.ball;
motion.ball=(ctx,p,radius)=>bodies.push({z:p.z,radius});
render(motion,{progress:expandedMoment});
motion.ball=originalBall;
const far=bodies.filter(p=>p.z<-.35),near=bodies.filter(p=>p.z>.7);
assert.ok(far.length>0&&near.length>0,'the cloud contains both distant and close foreground volumes');
const average=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
assert.ok(average(near.map(p=>p.radius))>average(far.map(p=>p.radius))*2,
  'foreground magic balls are visibly larger than distant orbs');

// Equal source geometry, destination and depth still need different motion.
// Variation must come from each orb's clock, not just different travel lengths.
const independentMotion=Array.from({length:24},(_,i)=>{
  const body={...motion.orbs[8],depth:.4,seed:100+i*2.73};
  const path=motion.orbit(body,materialOrigin,1);
  const at=seconds=>motion.position(path,seconds/duration,materialOrigin);
  return {path,at,speed:speed(at,path.burstEnd*duration,path.nudgeAt*duration)};
});
const slowSpeeds=independentMotion.map(item=>item.speed);
assert.ok(Math.max(...slowSpeeds)-Math.min(...slowSpeeds)>average(slowSpeeds)*.4,
  'same-shape and same-depth orbs have visibly different individual drift speeds');
const returnStarts=independentMotion.map(item=>item.path.pullAt*duration);
assert.ok(Math.max(...returnStarts)-Math.min(...returnStarts)>.08,
  'orb returns are gently staggered instead of an entire cloud switching in lockstep');
for(const {path,at} of independentMotion){
  for(let i=0;i<10;i++){
    const a=path.burstEnd+(path.pullAt-path.burstEnd)*i/10;
    const b=path.burstEnd+(path.pullAt-path.burstEnd)*(i+1)/10;
    assert.ok(speed(at,a*duration,b*duration)>5,
      'every orb stays in motion through the expanded field and preparatory push');
  }
  assert.ok(radius(at(path.pullAt*duration))>radius(at(path.nudgeAt*duration))*1.05,
    'each individual sphere has a measurable extra outward push before returning');
  const finish=at(duration);
  assert.ok(Math.hypot(finish.x-materialOrigin.x,finish.y-materialOrigin.y)<1e-8);
  assert.ok(finish.alpha<.01);
}

console.log('Reveal gather: immutable snapshots, bounded drawing, pause determinism, round clouds, living outward drift, preparatory expansion, independent speeds, continuous joins and foreground depth passed.');
