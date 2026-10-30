/* Presentation profiles only. Ranks never select or mutate a certification. */
(function(root){
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
  const transition=.65;
  const minimums=[0,200,350,550,750,900,999];
  const blendedKeys=['speed','widthScale','swayScale','cloudAmount','vortexMix','sizeScale','heightScale','populationScale','cohesion','starScale','stormFlash'];
  const rows=[
    ['E', .3,.30,0,0,0,1,0,.40,.4],
    ['D', .4,.40,0,0,0,1,0,.58,.6],
    ['C', .5,.5,0,0,0,1,0,.8,.8],
    ['B', .6,.7,.48,0,0,1,0,1,.8],
    ['A', .7,.9,.64,0,0,1,0,1,.9],
    ['S', .8,.9,.68,1,0,1,.65,1,1],
    ['SS',1,1,1,1,0,1,1,1,1]
  ];
  const profiles=Object.freeze(rows.map(([rank,speed,widthScale,swayScale,cloudAmount,vortexMix,sizeScale,starScale,heightScale,populationScale])=>
    Object.freeze({rank,speed,widthScale,swayScale,cloudAmount,vortexMix,sizeScale,starScale,heightScale,populationScale,
      cohesion:rank==='E'?.12:rank==='D'?.58:1,stormFlash:rank==='SS'?1:0})));
  const byRank=new Map(profiles.map(profile=>[profile.rank,profile]));
  const forRank=rank=>byRank.get(rank)||profiles[profiles.length-1];
  function profileForValue(value){
    const mana=Math.max(0,finite(value));
    for(let i=profiles.length-1;i>0;i--)if(mana>=minimums[i])return profiles[i];
    return profiles[0];
  }
  function inverseSmooth(value){
    if(value<=0)return 0;if(value>=1)return 1;
    let lo=0,hi=1;
    for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(smooth(mid)<value)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  const schedules=new Map();
  function scheduleFor(target){
    if(schedules.has(target))return schedules.get(target);
    const timing=root.FireScanTransition.timing;
    const events=[];
    for(let i=1;i<profiles.length;i++)if(target>=minimums[i])events.push({
      at:timing.scanStart+timing.scanDuration*inverseSmooth(minimums[i]/target),
      from:profiles[i-1],to:profiles[i]
    });
    if(schedules.size>=16)schedules.delete(schedules.keys().next().value);
    schedules.set(target,events);return events;
  }
  function sample(elapsed,result,formationDuration=0){
    const time=Math.max(0,finite(elapsed)),target=Math.max(0,Math.trunc(finite(result?.mana)));
    const formation=Math.max(0,finite(formationDuration));
    const scan=root.FireScanTransition.sample(time,result);
    const profile={...profileForValue(scan.value)};
    for(const key of blendedKeys)profile[key]=profiles[0][key];
    let visualTime=(formation+time)*profiles[0].speed;
    for(const event of scheduleFor(target)){
      const age=Math.max(0,time-event.at),p=clamp(age/transition),blend=smooth(p);
      // Analytic integral of smoothstep: growing wind changes velocity,
      // never the existing texture phase. Absolute sampling also makes
      // pause, replay and a hidden tab independent of frame frequency.
      const area=age<transition?transition*(p*p*p-.5*p*p*p*p):age-transition*.5;
      visualTime+=area*(event.to.speed-event.from.speed);
      for(const key of blendedKeys)profile[key]+=blend*(event.to[key]-event.from[key]);
    }
    // Glint birth positions use this same integrated clock. Their lifetime
    // stays one host second while later rank changes cannot move their origin.
    const timeAt=hostTime=>{
      let visual=Math.max(0,finite(hostTime))*profiles[0].speed;
      for(const event of scheduleFor(target)){
        const age=Math.max(0,hostTime-formation-event.at),p=clamp(age/transition);
        const area=age<transition?transition*(p*p*p-.5*p*p*p*p):age-transition*.5;
        visual+=area*(event.to.speed-event.from.speed);
      }
      return visual;
    };
    return {value:scan.value,profile:Object.freeze(profile),time:visualTime,timeAt};
  }
  root.WindRankEffects=Object.freeze({profiles,forRank,profileForValue,sample});
})(globalThis);
