/* Art profiles only. They never select or change a certification result.
 * Dimensions describe separate rock structures in a fixed camera, not zoom. */
(function(root){
  'use strict';
  const stone=(seed,width,height,depth,position,kind='boulder',lift=0,side=0)=>
    Object.freeze({seed,width,height,depth,position:Object.freeze(position),kind,lift,side});
  const rows=[
    {rank:'E',name:'砂礫初凝',speed:.32,opening:0,impact:0,mineral:0,dustCount:55,chipsCount:3,starScale:0,extent:.28,stones:[
      stone(32,.19,.30,.17,[0,-.28,0]),
      stone(37,.065,.10,.055,[-.22,-.36,.06]),
      stone(41,.055,.09,.05,[.20,-.23,-.07])
    ]},
    {rank:'D',name:'碎岩聚合',speed:.42,opening:.22,impact:.10,mineral:0,dustCount:65,chipsCount:4,starScale:0,extent:.43,stones:[
      stone(32,.25,.39,.23,[-.09,-.21,0],'boulder',.025,-.02),
      stone(38,.18,.27,.19,[.23,-.30,.03],'boulder',.07,.04),
      stone(42,.18,.25,.16,[.02,.04,-.07],'boulder',.14,-.02),
      stone(46,.11,.18,.10,[-.27,-.04,.03],'boulder',.11,-.05)
    ]},
    {rank:'C',name:'厚岩成核',speed:.52,opening:.30,impact:.20,mineral:.04,dustCount:75,chipsCount:5,starScale:0,extent:.60,stones:[
      stone(33,.43,.60,.37,[-.06,-.12,0]),
      stone(38,.27,.43,.26,[.26,-.15,.08],'boulder',.07,.025),
      stone(42,.30,.30,.28,[-.06,.22,-.02],'boulder',.10,-.015),
      stone(47,.18,.31,.18,[-.32,-.04,.11],'boulder',.055,-.025)
    ]},
    {rank:'B',name:'岩層隆起',speed:.62,opening:.42,impact:.34,mineral:.10,dustCount:88,chipsCount:7,starScale:0,extent:.76,stones:[
      stone(2,.64,.48,.48,[-.03,-.39,.01],'root'),
      stone(3,.69,.30,.51,[0,-.10,0],'layer',.12,.045),
      stone(4,.55,.30,.43,[-.03,.14,-.03],'layer',.23,-.05),
      stone(7,.34,.34,.29,[-.13,.37,-.10],'boulder',.29,-.04),
      stone(9,.26,.29,.23,[.34,.23,.04],'boulder',.22,.05)
    ]},
    {rank:'A',name:'懸山成形',speed:.74,opening:.60,impact:.52,mineral:.24,dustCount:105,chipsCount:9,starScale:0,extent:.90,stones:[
      stone(2,.80,.59,.60,[-.03,-.44,.02],'root'),
      stone(3,.82,.32,.63,[0,-.12,0],'layer',.16,.065),
      stone(4,.70,.31,.54,[-.045,.15,-.02],'layer',.28,-.07),
      stone(7,.43,.60,.38,[-.16,.49,-.12],'peak',.38,-.08),
      stone(9,.32,.39,.30,[.40,.37,.02],'peak',.29,.09),
      stone(17,.17,.30,.16,[.45,-.29,.39],'layer',.12,.08),
      stone(23,.19,.25,.18,[-.38,-.04,.47],'layer',.22,-.09)
    ]},
    {rank:'S',name:'地脈覺醒',speed:.86,opening:.82,impact:.76,mineral:.70,dustCount:125,chipsCount:12,starScale:.65,extent:1,stones:[
      stone(2,.91,.63,.69,[-.03,-.47,.02],'root'),
      stone(3,.94,.33,.72,[0,-.13,0],'layer',.18,.08),
      stone(4,.81,.33,.61,[-.045,.16,-.02],'layer',.32,-.085),
      stone(7,.50,.68,.44,[-.16,.56,-.12],'peak',.45,-.10),
      stone(9,.36,.46,.33,[.44,.43,.02],'peak',.35,.115),
      stone(13,.26,.35,.30,[-.57,.30,.04],'peak',.29,-.15),
      stone(17,.21,.37,.18,[.55,-.31,.43],'layer',.15,.10),
      stone(23,.23,.31,.20,[-.43,-.03,.54],'layer',.27,-.11)
    ]},
    // Null intentionally selects the accepted study's original mesh catalog.
    {rank:'SS',name:'地脈之心',speed:1,opening:1,impact:1,mineral:1,dustCount:145,chipsCount:15,starScale:1,extent:1.12,stones:null}
  ];
  const profiles=Object.freeze(rows.map(p=>Object.freeze({...p,stones:p.stones&&Object.freeze(p.stones)})));
  const byRank=new Map(profiles.map(p=>[p.rank,p]));
  const forRank=rank=>byRank.get(rank)||profiles[profiles.length-1];
  const minimums=[0,200,350,550,750,900,999],transition=.72;
  const keys=['speed','opening','impact','mineral','dustCount','chipsCount','starScale','extent'];
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const actionTiming=Object.freeze({startPhase:2.95,accelerationDuration:.2,
    boostSpeed:1.8,decelerationPhase:4.6,decelerationDuration:.32});
  const actionSpeed=speed=>Number.isFinite(speed)&&speed>0?speed:1;
  const smoothArea=p=>p*p*p-.5*p*p*p*p;
  const acceleratedPhase=actionTiming.startPhase+actionTiming.boostSpeed*actionTiming.accelerationDuration*.5;
  const decelerationStart=actionTiming.accelerationDuration
    +(actionTiming.decelerationPhase-acceleratedPhase)/actionTiming.boostSpeed;
  const settledAt=decelerationStart+actionTiming.decelerationDuration;
  const settledPhase=speed=>actionTiming.decelerationPhase
    +(actionTiming.boostSpeed+speed)*actionTiming.decelerationDuration*.5;
  // The counter has already spread the stones to about 80% of their opening.
  // Continue from that exact pose, stretch a little further, then compress.
  // Contact remains after the final 0.72 s rank morph has finished, keeping
  // collision birth positions and the accepted rigid endpoint geometry exact.
  function actionTimeForElapsed(postAge,speed=1){
    const age=Math.max(0,finite(postAge)),rate=actionSpeed(speed),a=actionTiming;
    if(age<a.accelerationDuration)
      return a.startPhase+a.boostSpeed*a.accelerationDuration*smoothArea(age/a.accelerationDuration);
    if(age<decelerationStart)return acceleratedPhase+(age-a.accelerationDuration)*a.boostSpeed;
    if(age<settledAt){
      const dt=age-decelerationStart;
      return a.decelerationPhase+dt*a.boostSpeed
        +(rate-a.boostSpeed)*a.decelerationDuration*smoothArea(dt/a.decelerationDuration);
    }
    return settledPhase(rate)+(age-settledAt)*rate;
  }
  function actionElapsedForTime(actionTime,speed=1){
    const phase=Math.max(actionTiming.startPhase,finite(actionTime,actionTiming.startPhase));
    const rate=actionSpeed(speed),a=actionTiming;
    if(phase<=a.startPhase)return 0;
    if(phase>=settledPhase(rate))return settledAt+(phase-settledPhase(rate))/rate;
    if(phase>=acceleratedPhase&&phase<=a.decelerationPhase)
      return a.accelerationDuration+(phase-acceleratedPhase)/a.boostSpeed;
    // Only the two short easing intervals need inversion. Both are monotone,
    // and fixed bisection makes rewind/contact reconstruction deterministic.
    let lo=phase<acceleratedPhase?0:decelerationStart;
    let hi=phase<acceleratedPhase?a.accelerationDuration:settledAt;
    for(let i=0;i<48;i++){
      const mid=(lo+hi)/2;
      if(actionTimeForElapsed(mid,rate)<phase)lo=mid;else hi=mid;
    }
    return (lo+hi)/2;
  }
  const profileForValue=value=>{
    const mana=Math.max(0,finite(value));
    for(let i=profiles.length-1;i>0;i--)if(mana>=minimums[i])return profiles[i];
    return profiles[0];
  };
  const schedules=new Map();
  function scheduleFor(target){
    if(schedules.has(target))return schedules.get(target);
    const timing=root.FireScanTransition.timing,events=[];
    for(let i=1;i<profiles.length;i++)if(target>=minimums[i]){
      let lo=0,hi=1;
      for(let j=0;j<40;j++){const m=(lo+hi)/2;if(smooth(m)<minimums[i]/target)lo=m;else hi=m;}
      events.push({index:i,at:timing.scanStart+timing.scanDuration*(lo+hi)/2});
    }
    if(schedules.size>=16)schedules.delete(schedules.keys().next().value);
    schedules.set(target,events);return events;
  }
  function ambientTimeAt(t,target,formation){
    let time=(formation+t)*profiles[0].speed;
    for(const {index,at} of scheduleFor(target)){
      const age=Math.max(0,t-at),p=clamp(age/transition);
      const area=age<transition?transition*(p*p*p-.5*p*p*p*p):age-transition*.5;
      time+=area*(profiles[index].speed-profiles[index-1].speed);
    }
    return time;
  }
  function sample(elapsed,result,formationDuration=0){
    const t=Math.max(0,finite(elapsed)),formation=Math.max(0,finite(formationDuration));
    const target=Math.max(0,Math.trunc(finite(result?.mana))),scan=root.FireScanTransition.sample(t,result);
    const weights=[1,0,0,0,0,0,0];let time=(formation+t)*profiles[0].speed;
    for(const {index,at} of scheduleFor(target)){
      const age=Math.max(0,t-at),p=clamp(age/transition),amount=smooth(p);
      // Adjacent differences form nonnegative weights even when a high result
      // crosses several thresholds quickly. The entire shape stays continuous.
      weights[index-1]-=amount;weights[index]+=amount;
      const area=age<transition?transition*(p*p*p-.5*p*p*p*p):age-transition*.5;
      time+=area*(profiles[index].speed-profiles[index-1].speed);
    }
    const profile={...profileForValue(scan.value)};
    for(const key of keys)profile[key]=profiles.reduce((sum,p,i)=>sum+p[key]*weights[i],0);
    const speed=profileForValue(target).speed,complete=root.FireScanTransition.timing.complete;
    // All rank blends finish by complete + transition. Extrapolating the final
    // linear segment back gives collision sources the matching ambient time.
    const actionOrigin=ambientTimeAt(complete+transition,target,formation)-speed*transition;
    const scanStart=root.FireScanTransition.timing.scanStart;
    // Begin opening while the first pieces grow, rather than nesting two
    // slow-in curves and leaving most of the early scan visually closed.
    const spreadProgress=1-Math.pow(1-scan.progress,2);
    const growingPhase=t<scanStart?.3+1.3*smooth(t/scanStart)
      :1.6+(actionTiming.startPhase-1.6)*spreadProgress;
    return {value:scan.value,profile:Object.freeze(profile),time,
      actionTime:t<complete?growingPhase:actionTimeForElapsed(t-complete,speed),actionOrigin,actionSpeed:speed,
      level:weights.reduce((sum,w,i)=>sum+w*i,0),weights:Object.freeze(weights)};
  }
  root.EarthRankEffects=Object.freeze({profiles,forRank,profileForValue,sample,
    actionTiming,actionTimeForElapsed,actionElapsedForTime});
})(globalThis);
