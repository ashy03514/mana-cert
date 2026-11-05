/* Pure lightning presentation. Event frequency changes without slowing the
 * physical descent or mutating a committed certification result. */
(function(root){
  'use strict';
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const p=clamp(v);return p*p*(3-2*p);};
  const transition=.65,cycleSeconds=4.4/1.5,hitTime=1.28;
  const ranks=['E','D','C','B','A','S','SS'];
  const minimums=[0,200,350,550,750,900,999];
  const columns={
    speed:[.48,.56,.64,.72,.82,.9,1],
    strikeRate:[.4,.45,.5,.62,.75,.86,1],
    arcReach:[.25,.38,.52,.65,.78,.9,1],
    arcWidth:[.38,.46,.56,.68,.8,.9,1],
    arcSecondary:[0,.15,.3,.45,.65,.8,1],
    branches:[0,.15,.3,.45,.65,.85,1],
    orbScale:[.3,.43,.56,.68,.8,.9,1],
    skyStrength:[0,0,.35,.55,.75,.9,1],
    strikeWidth:[.26,.3,.35,.5,.7,.85,1],
    doubleGain:[0,0,0,0,.35,.7,1],
    tripleGain:[0,0,0,0,0,0,1],
    sparks:[.06,.1,.25,.42,.62,.82,1],
    skyLight:[.1,.15,.25,.4,.6,.8,1],
    brightness:[.5,.6,.7,.8,.88,.94,1]
  };
  const keys=Object.keys(columns);
  const profiles=Object.freeze(ranks.map((rank,i)=>Object.freeze({rank,
    ...Object.fromEntries(keys.map(key=>[key,columns[key][i]]))})));
  const byRank=new Map(profiles.map(profile=>[profile.rank,profile]));
  const forRank=rank=>byRank.get(rank)||profiles[6];
  function profileForValue(value){
    const mana=Math.max(0,finite(value));
    for(let i=profiles.length-1;i>0;i--)if(mana>=minimums[i])return profiles[i];
    return profiles[0];
  }
  function inverseSmooth(value){
    if(value<=0)return 0;if(value>=1)return 1;
    let lo=0,hi=1;
    for(let i=0;i<40;i++){
      const mid=(lo+hi)/2;
      if(smooth(mid)<value)lo=mid;else hi=mid;
    }
    return (lo+hi)/2;
  }
  function area(age){
    if(age<=0)return 0;
    if(age>=transition)return age-transition*.5;
    const p=age/transition;
    return transition*(p*p*p-.5*p*p*p*p);
  }
  const schedules=new Map();
  function scheduleFor(target,formation){
    const id=target+':'+formation;
    if(schedules.has(id))return schedules.get(id);
    const timing=root.FireScanTransition.timing;
    const events=[];
    for(let i=1;i<profiles.length;i++)if(target>=minimums[i])events.push({
      at:formation+timing.scanStart+timing.scanDuration*inverseSmooth(minimums[i]/target),
      from:profiles[i-1],to:profiles[i]
    });
    const schedule={events,target,formation,impacts:new Map()};
    const firstC=events.find(event=>event.to.rank==='C');
    schedule.firstImpact=firstC?firstC.at+.45:null;
    schedule.anchor=firstC?integral(schedule,schedule.firstImpact,'strikeRate'):0;
    if(schedules.size>=16)schedules.delete(schedules.keys().next().value);
    schedules.set(id,schedule);
    return schedule;
  }
  function integral(schedule,time,key){
    let value=Math.max(0,time)*profiles[0][key];
    for(const event of schedule.events)value+=area(time-event.at)*(event.to[key]-event.from[key]);
    return value;
  }
  function profileAt(schedule,time,value){
    const mana=value??root.FireScanTransition.sample(Math.max(0,time-schedule.formation),{mana:schedule.target}).value;
    const profile={...profiles[0],rank:profileForValue(mana).rank};
    for(const event of schedule.events){
      const blend=smooth((time-event.at)/transition);
      for(const key of keys)profile[key]+=blend*(event.to[key]-event.from[key]);
    }
    return Object.freeze(profile);
  }
  function impactFor(schedule,cycle){
    if(schedule.impacts.has(cycle))return schedule.impacts.get(cycle);
    let at=schedule.firstImpact;
    if(cycle>0){
      const destination=schedule.anchor+cycle*cycleSeconds;
      // The rate stays positive. Inverting the cumulative phase gives one
      // real-time birth instant, unaffected by subsequent tier changes.
      let lo=at,hi=Math.max(at,destination/profiles[0].strikeRate+1);
      for(let i=0;i<48;i++){
        const mid=(lo+hi)/2;
        if(integral(schedule,mid,'strikeRate')<destination)lo=mid;else hi=mid;
      }
      at=(lo+hi)/2;
    }
    const event=Object.freeze({at,profile:profileAt(schedule,at)});
    if(schedule.impacts.size>=32)schedule.impacts.delete(schedule.impacts.keys().next().value);
    schedule.impacts.set(cycle,event);
    return event;
  }
  function initial(time=0){
    return {value:0,profile:profiles[0],time:Math.max(0,finite(time))*profiles[0].speed,
      stormTime:0,impactAge:-hitTime,strikeProfile:profiles[0]};
  }
  function preview(time=0,rank='SS'){
    const hostTime=Math.max(0,finite(time)),profile=forRank(rank);
    const stormTime=hostTime*profile.strikeRate,cycle=Math.floor(stormTime/cycleSeconds);
    const impactAge=profile.strikeRate===1?hostTime%cycleSeconds-hitTime:
      hostTime-(cycle*cycleSeconds+hitTime)/profile.strikeRate;
    return {value:root.ManaConfig?.ranks?.[profile.rank]?.range[1]??minimums[ranks.indexOf(profile.rank)],
      profile,time:hostTime*profile.speed,stormTime,impactAge,strikeProfile:profile};
  }
  function sample(elapsed,result,formationDuration=0){
    const time=Math.max(0,finite(elapsed)),formation=Math.max(0,finite(formationDuration));
    const target=Math.max(0,Math.min(999,Math.trunc(finite(result?.mana))));
    const hostTime=formation+time,schedule=scheduleFor(target,formation);
    const scan=root.FireScanTransition.sample(time,result),profile=profileAt(schedule,hostTime,scan.value);
    const motionTime=integral(schedule,hostTime,'speed');
    if(schedule.firstImpact===null)return {value:scan.value,profile,time:motionTime,
      stormTime:0,impactAge:-hitTime,strikeProfile:profile};
    const stormTime=Math.max(0,hitTime+integral(schedule,hostTime,'strikeRate')-schedule.anchor);
    const event=impactFor(schedule,Math.floor(stormTime/cycleSeconds));
    return {value:scan.value,profile,time:motionTime,stormTime,
      impactAge:hostTime-event.at,strikeProfile:event.profile};
  }
  root.LightningRankEffects=Object.freeze({profiles,forRank,profileForValue,initial,preview,sample});
})(globalThis);
