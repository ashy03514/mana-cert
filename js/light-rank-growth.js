/* Formal light presentation: deterministic wing growth from the committed
 * result. This module never chooses an outcome or changes a saved result. */
(function(root){
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
  const TIMING=Object.freeze({formation:1.2,settle:.9,rest:.10,initialSettle:.9});
  const inverseSmooth=value=>{
    let low=0,high=1;
    for(let i=0;i<36;i++){const mid=(low+high)/2;if(smooth(mid)<value)low=mid;else high=mid;}
    return (low+high)/2;
  };
  const targetRank=result=>['A','S','SS'].includes(result?.rank)?result.rank:
    finite(result?.mana)>=999?'SS':finite(result?.mana)>=900?'S':'A';
  function eventsFor(result){
    const rank=targetRank(result);if(rank==='A')return [];
    const t=root.FireScanTransition.timing,target=Math.max(1,finite(result?.mana));
    const crossing=threshold=>t.scanStart+t.scanDuration*inverseSmooth(clamp(threshold/target));
    const event=(from,to,at)=>({from,to,at,duration:TIMING.formation,
      formedAt:at+TIMING.formation,completeAt:at+TIMING.formation+TIMING.settle});
    // Shape formation and return to normal feather color are distinct phases.
    // The numeric result keeps its original timing; presentation may finish a
    // little later rather than cutting short either approved visual phase.
    if(rank==='S'){
      return [event('A','S',Math.max(t.scanStart+.10,crossing(900)-TIMING.formation))];
    }
    // SS can cross 900 and 999 almost together. Start the first transition
    // early enough to show both complete silhouettes and their settled color,
    // with no simultaneous morphs and no flash from an unfinished S→SS handoff.
    const first=event('A','S',Math.max(t.scanStart+.10,
      Math.min(t.scanStart+.20,crossing(900)-TIMING.formation)));
    return [first,event('S','SS',first.completeAt+TIMING.rest)];
  }
  const schedules=new Map();
  function schedule(result){
    const key=targetRank(result)+':'+finite(result?.mana);
    if(!schedules.has(key)){
      if(schedules.size>=16)schedules.delete(schedules.keys().next().value);
      schedules.set(key,Object.freeze(eventsFor(result).map(Object.freeze)));
    }
    return schedules.get(key);
  }
  // Only the numeric climb below A is accelerated. The wing formation clock
  // remains independent, preserving complete silhouettes and exposure settles.
  function scanElapsed(elapsed,result){
    const t=root.FireScanTransition.timing,time=Math.max(0,finite(elapsed));
    const target=Math.max(1,Math.min(999,finite(result?.mana)));
    const toA=t.scanDuration*inverseSmooth(clamp(750/target));
    const active=Math.max(0,time-t.scanStart),fastSpan=toA/1.5;
    if(time<=t.scanStart)return time;
    if(active<=fastSpan)return t.scanStart+active*1.5;
    // Ease the clock rate from 1.5x to 1x over 180 ms after reaching A.
    const after=active-fastSpan,blend=.18,u=clamp(after/blend);
    const extra=.5*blend*(u-u*u*u+.5*u*u*u*u);
    return t.scanStart+toA+after+extra;
  }
  function scan(elapsed,result){
    const sampled=root.FireScanTransition.sample(scanElapsed(elapsed,result),result);
    return {...sampled,rank:sampled.rank==='—'?'E':sampled.rank,
      label:sampled.label==='火焰蓄熱'?'聖光凝聚':sampled.label};
  }
  function sample(elapsed,result,formationDuration=.8){
    const elapsedTime=Math.max(0,finite(elapsed)),formation=Math.max(0,finite(formationDuration));
    const sampled=scan(elapsedTime,result);
    const events=schedule(result);
    let growth=0,time=(formation+elapsedTime)*.70;
    let transition={from:'A',to:'A',progress:1},exposure=1-smooth(elapsedTime/TIMING.initialSettle);
    let phase=exposure>0?'settling':'settled';
    for(const event of events){
      const age=Math.max(0,elapsedTime-event.at),progress=clamp(age/event.duration);
      growth+=smooth(progress);
      // Exact integral of a smoothstep speed increase. A changing strength
      // never rewinds the wing flutter, illumination noise or particle phase.
      const area=age<event.duration?event.duration*(progress**3-.5*progress**4):age-event.duration*.5;
      time+=area*.15;
      if(elapsedTime>=event.at){
        // Keep the completed source→target pair through its exposure settle.
        // Deriving the pair from floor(growth) would switch to the next image
        // precisely at growth=1 and lose S's required high-exposure endpoint.
        transition={from:event.from,to:event.to,progress:smooth(progress)};
        exposure=1-smooth((elapsedTime-event.formedAt)/TIMING.settle);
        phase=elapsedTime<event.formedAt?'forming':exposure>0?'settling':'settled';
      }
    }
    const rank=growth>=2?'SS':growth>=1?'S':'A';
    const starMana=growth<=1?growth*950:950+(growth-1)*49;
    const completeAt=Math.max(root.FireScanTransition.timing.complete,events.at(-1)?.completeAt||TIMING.initialSettle);
    return {value:sampled.value,rank,growth,time,starMana,transition,exposure,phase,completeAt,complete:elapsedTime>=completeAt};
  }
  function initial(materialTime=0){return {value:0,rank:'A',growth:0,time:Math.max(0,finite(materialTime))*.70,starMana:0,
    transition:{from:'A',to:'A',progress:1},exposure:1,phase:'forming',complete:false};}
  function layout(width,height,shift=0,{preview=false}={}){
    const w=Math.max(1,finite(width,1)),h=Math.max(1,finite(height,1)),amount=clamp(finite(shift));
    const sideBySide=w>=h*1.35,bottom=h-(preview?222:86),compact=h<760;
    const fontSize=Math.max(28,Math.min(compact?36:52,w*.125,h*.075));
    const rankFontSize=Math.max(19,Math.min(26,fontSize*.5));
    const labelFontSize=compact?13:18;
    let box,x,y;
    if(sideBySide){
      box={x:12,y:28,width:Math.min(w*.53-24,900),height:Math.max(100,h-64)};
      x=w*.77;y=Math.min(bottom-rankFontSize-24,Math.max(148,h*.53));
    }else{
      const stageHeight=Math.max(100,Math.min(h*.50,h-(preview?360:300)));
      const lift=Math.min(36,h*.045);
      box={x:8,y:42+lift*(1-amount),width:Math.min(w-16,900),height:stageHeight};
      box.x=(w-box.width)/2;
      x=w/2;y=Math.min(bottom-rankFontSize-24,42+stageHeight+fontSize+(compact?24:38));
    }
    const artHeight=Math.min(box.height*.87,box.width/1.5*.87);
    // Gathering keeps the pre-shift root position; the material rises only
    // after it has formed and the readout is about to appear.
    const restY=sideBySide?28:42+Math.min(36,h*.045);
    box.gatherY=restY+(box.height-artHeight)*.5+artHeight*.72;
    return {box,sideBySide,numbers:{x,y,fontSize,rankFontSize,labelFontSize,
      labelY:y-fontSize-labelFontSize*.35,rankY:y+rankFontSize+14}};
  }
  root.LightRankGrowth=Object.freeze({scan,sample,initial,layout,timing:TIMING,timeline:schedule});
})(globalThis);
