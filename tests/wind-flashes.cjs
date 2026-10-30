'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/wind-rank-effects.js');
require('../js/wind-tornado-renderer.js');

// Exercise the same deterministic CPU light packets uploaded by the renderer.
// Actual density confinement and alpha preservation are checked with GPU pixels.
const wind=Object.create(WindTornadoRenderer.prototype),SS=WindRankEffects.forRank('SS');
const originalRandom=Math.random;
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,label);
Math.random=()=>{throw Error('internal thunder must not consume result randomness');};
try{
  assert.deepEqual(WindRankEffects.profiles.filter(p=>p.stormFlash>0).map(p=>p.rank),['SS']);
  const sample=(time,profile=SS,formation=1,visual=time*2.25)=>wind.flashFrame(time,visual,profile,formation);
  const dark=frame=>frame.cloud[3]===0&&frame.funnel[3]===0;
  for(const profile of WindRankEffects.profiles.filter(p=>p.rank!=='SS')){
    for(let i=0;i<=800;i++)assert.ok(dark(sample(i*.025,profile)),profile.rank+' never has internal thunder');
  }
  for(const time of [0,.6,1,2,6,25]){
    assert.ok(dark(sample(time,SS,0)),'unformed wind cannot flash');
    assert.ok(dark(sample(time,SS,.8)),'formation retains the dark introduction');
  }
  assert.ok(dark(sample(-1)));assert.ok(dark(sample(NaN)));

  const step=.005,duration=38;
  const channels={cloud:{lit:0,max:0,segments:[],start:null},funnel:{lit:0,max:0,segments:[],start:null}};
  let darkFrames=0,peakTime=null;
  for(let i=0;i<=duration/step;i++){
    const time=i*step,frame=sample(time);
    assert.deepEqual(frame,sample(time),'replaying or pausing at the same active time is exact');
    if(dark(frame))darkFrames++;
    for(const key of Object.keys(channels)){
      const light=frame[key],stats=channels[key];
      assert.equal(light.length,4);assert.ok(light.every(Number.isFinite),'uniform light packet remains finite');
      assert.ok(light[3]>=0&&light[3]<=1,'light intensity remains bounded');
      stats.max=Math.max(stats.max,light[3]);
      if(light[3]>.01){
        stats.lit++;
        if(stats.start===null)stats.start=time;
        if(key==='cloud'&&light[3]>.7)peakTime=time;
      }else if(stats.start!==null){stats.segments.push(time-stats.start);stats.start=null;}
    }
    // The top of the accepted close-up is near world y=.95; these events
    // must live in the visible cloud shelf, not above the cropped screen.
    assert.ok(frame.cloud[1]>=.7&&frame.cloud[1]<=.9);
    const h=(frame.funnel[1]+.86)/1.78,axis=wind.spine(h,time*2.25,SS);
    near(frame.funnel[0],axis.x,'column light follows the moving centreline');
    near(frame.funnel[2],axis.z-.04,'column light stays embedded behind the wind surface');
  }
  assert.ok(darkFrames>duration/step*.55,'quiet gaps dominate rather than continuous flicker');
  for(const [key,stats] of Object.entries(channels)){
    assert.ok(stats.max>.65,key+' receives readable flashes');
    assert.ok(stats.lit>200&&stats.lit<duration/step*.35,key+' flashes intermittently');
    assert.ok(stats.segments.length>=8,key+' produces repeated separate bursts');
    assert.ok(stats.segments.every(span=>span>=.06&&span<=.65),key+' bursts stay short but readable');
  }
  assert.notEqual(peakTime,null);
  const full=sample(peakTime),half=sample(peakTime,{...SS,stormFlash:.5}),forming=sample(peakTime,SS,.9);
  for(const key of ['cloud','funnel']){
    near(half[key][3],full[key][3]*.5,'SS entry scales the light without changing the event');
    near(forming[key][3],full[key][3]*.5,'formation fades internal illumination smoothly');
    near(sample(peakTime,SS,1,peakTime*.5)[key][3],full[key][3],'pulse lifetime uses active seconds instead of multiplied wind speed');
  }

  const result=Object.freeze({type:'magic',element:'風',rank:'SS',mana:1000});
  const at=FireScanTransition.timing.complete,formation=.8;
  const before=WindRankEffects.sample(at-1e-5,result,formation),entry=WindRankEffects.sample(at+1e-5,result,formation);
  assert.equal(before.profile.stormFlash,0);assert.ok(entry.profile.stormFlash<1e-6,'crossing 1000 has no brightness step');
  const growing=WindRankEffects.sample(at+.3,result,formation),settled=WindRankEffects.sample(at+.7,result,formation);
  assert.ok(growing.profile.stormFlash>0&&growing.profile.stormFlash<1);near(settled.profile.stormFlash,1,'settled SS reaches its full light gain');
  for(const mana of [10,199,200,349,350,549,550,749,750,899,900,999]){
    assert.equal(WindRankEffects.sample(20,{mana,element:'風'},formation).profile.stormFlash,0,'non-SS final results remain unlit');
  }
  for(const start of [120,3600,86400,1e7])for(let i=0;i<180;i++){
    const time=start+i*.03,frame=sample(time);
    for(const values of Object.values(frame))assert.ok(values.every(Number.isFinite)&&values[3]>=0&&values[3]<=1,'long-running animation retains finite bounded flashes');
    assert.deepEqual(frame,sample(time),'late replay remains deterministic');
  }
  console.log('Wind flashes passed: SS-only threshold and fade, deterministic active-time pulses, embedded moving sources, quiet gaps, readable bursts, formation and long-running stability.');
}finally{Math.random=originalRandom;}
