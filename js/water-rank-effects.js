/* Water presentation only: rank profiles and an integrated active-time clock. */
(function(root){
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
  const TRANSITION=.65;
  const blendedKeys=['speed','waveScale','seaTexture','foamAmount','breakers','starScale','sprayDuty'];
  const rows=[
    [0,'E',.3,.3,0,0,0,0],
    [200,'D',.4,.4,1,.18,0,0],
    [350,'C',.5,.5,1,.18,0,0],
    [550,'B',.6,.6,1,.5,0,0],
    [750,'A',.7,.7,1,.5,0,0],
    [900,'S',.8,1,1,1,.42,.65],
    [999,'SS',1,1,1,1,1,1]
  ];
  const profiles=Object.freeze(rows.map(([minimum,rank,speed,waveScale,seaTexture,foamAmount,sprayDuty,starScale])=>
    Object.freeze({minimum,rank,speed,waveScale,seaTexture,foamAmount,sprayDuty,starScale,breakers:minimum>=900?1:0})));
  function profileForValue(value){
    const mana=Math.max(0,finite(value));
    for(let i=profiles.length-1;i>=0;i--)if(mana>=profiles[i].minimum)return profiles[i];
    return profiles[0];
  }
  function profileForPower(power){
    if(!Number.isFinite(power))return profiles.at(-1);
    for(let i=profiles.length-1;i>0;i--){
      if(power>=root.FireScanTransition.powerForValue(profiles[i].minimum))return profiles[i];
    }
    return profiles[0];
  }
  function inverseSmooth(value){
    if(value<=0)return 0;if(value>=1)return 1;
    let lo=0,hi=1;
    for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(smooth(mid)<value)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  // Cache only a small number of immutable crossing schedules, not outcomes.
  // Renders sample absolute time and never advance or reroll the host result.
  const schedules=new Map();
  function scheduleFor(target){
    if(schedules.has(target))return schedules.get(target);
    const timing=root.FireScanTransition.timing;
    const events=profiles.slice(1).filter(p=>target>=p.minimum).map(p=>({
      at:timing.scanStart+timing.scanDuration*inverseSmooth(p.minimum/target),
      from:profiles[profiles.indexOf(p)-1],to:p
    }));
    if(schedules.size>=16)schedules.delete(schedules.keys().next().value);
    schedules.set(target,events);return events;
  }
  function sample(elapsed,result,formationDuration=0){
    const time=Math.max(0,finite(elapsed)),target=Math.max(0,Math.trunc(finite(result?.mana)));
    const scan=root.FireScanTransition.sample(time,result);
    let visualTime=(Math.max(0,finite(formationDuration))+time)*profiles[0].speed;
    const profile={...profileForValue(scan.value),sprayGain:0,sprayFull:0};
    for(const key of blendedKeys)profile[key]=profiles[0][key];
    for(const event of scheduleFor(target)){
      const age=Math.max(0,time-event.at),p=clamp(age/TRANSITION),blend=smooth(p);
      // Integrate the eased speed analytically, so pause/seek/replay sample
      // the same phase and even closely spaced rank crossings remain smooth.
      const area=age<TRANSITION?TRANSITION*(p*p*p-.5*p*p*p*p):age-TRANSITION*.5;
      visualTime+=area*(event.to.speed-event.from.speed);
      for(const key of blendedKeys)profile[key]+=blend*(event.to[key]-event.from[key]);
      if(event.to.rank==='S')profile.sprayGain=blend;
      if(event.to.rank==='SS')profile.sprayFull=blend;
    }
    return {value:scan.value,profile:Object.freeze(profile),time:visualTime};
  }
  function sprayStrength(time,profile){
    const duty=clamp(finite(profile?.sprayDuty));
    const gain=clamp(finite(profile?.sprayGain,duty>0?1:0));
    const full=clamp(finite(profile?.sprayFull,duty===1?1:0));
    if(gain===0||full===1)return gain;
    const cycle=Math.max(0,finite(time))/2.6,phase=cycle-Math.floor(cycle);
    const pulse=smooth(phase/.07)*(1-smooth((phase-(.42-.07))/.07));
    return gain*(pulse*(1-full)+full);
  }
  root.WaterRankEffects=Object.freeze({profiles,profileForValue,profileForPower,sample,sprayStrength});
})(globalThis);
