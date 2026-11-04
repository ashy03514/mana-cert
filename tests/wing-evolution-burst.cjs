'use strict';
const assert=require('node:assert/strict');
for(const file of ['fire-scan-transition','light-rank-growth','dark-rank-growth','light-angel-motion','dark-demon-wing-motion'])require('../js/'+file+'.js');
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('Evolution cannot reroll the result');};Date.now=()=>{throw Error('Evolution must use the host clock');};
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,message+' '+a+' / '+b);
try{
 for(const [element,G,M,spread]of [['光',LightRankGrowth,LightAngelMotion,'expansion'],['暗',DarkRankGrowth,DarkDemonWingMotion,'release']]){
  for(const [rank,mana,count]of [['A',820,0],['S',950,1],['SS',999,2]]){
   const result=Object.freeze({type:'magic',element,rank,mana}),events=G.timeline(result);
   assert.equal(events.length,count);const complete=G.sample(0,result).completeAt;
   assert.equal(G.scan(20,result).value,mana);assert.equal(G.scan(20,result).rank,rank);
   let priorBurst=0,peaks=0;
   for(let i=0;i<=600;i++){
    const elapsed=i/60,s=G.sample(elapsed,result),a=G.evolutionAction(elapsed,result);
    assert.deepEqual(s.evolutionAction,a,'formal sample owns exactly the same deterministic action');
    assert.equal(G.scan(elapsed,result).value,LightRankGrowth.scan(elapsed,result).value,'presentation leaves numeric scan authoritative');
    for(const name of ['weight','charge','release','burst'])assert.ok(Number.isFinite(a[name])&&a[name]>=0&&a[name]<=1,name+' remains bounded');
    assert.equal(s.complete,elapsed>=complete);
    if(a.burst>0&&priorBurst===0)peaks++;
    priorBurst=a.burst;
   }
   assert.equal(peaks,count,'one action for each actual evolution and none at birth');
   for(const event of events){
    const pose=age=>{const s=G.sample(event.formedAt+age,result);return M.sample(s.time,event.to,s.evolutionAction);};
    const s=G.sample(event.formedAt,result),action=s.evolutionAction,p=M.profile(event.to),peak=pose(0);
    assert.equal(s.transition.to,event.to);
    close(s.transition.progress,1,'new silhouette is complete on the peak frame');
    close(peak[spread],p[spread],'full rank-appropriate spread at formation');
    close(peak.burst,p.burst,'flash peaks with the wings');
    close(peak.charge,0,'the intake has released by the peak');
    const forming=Array.from({length:121},(_,i)=>pose(event.duration*(i/120-1)));
    const settling=Array.from({length:91},(_,i)=>pose((event.completeAt-event.formedAt)*i/90));
    assert.ok(forming.some(frame=>frame.charge>0),'intake is visible during formation');
    const during=fraction=>G.sample(event.at+event.duration*fraction,result);
    const oldPose=fraction=>{const frame=during(fraction);return M.sample(frame.time,event.from,frame.evolutionAction);};
    // Sample the source skin too: A's idle profile has no ceremonial intake,
    // but its existing feathers must move as soon as the upgrade starts.
    assert.ok(oldPose(.10).charge>p.charge*.08,'source wing visibly starts charging near reveal onset');
    assert.ok(oldPose(.25).charge>p.charge*.50,'source wing is charging before the first quarter ends');
    assert.ok(oldPose(.25).charge>oldPose(.10).charge,'early intake builds gradually');
    assert.ok(oldPose(.50)[spread]>p[spread]*.05,'opening is underway halfway through formation');
    assert.ok(oldPose(.70)[spread]>p[spread]*.35,'opening has substantial travel before the final frames');
    for(const fraction of [.10,.25,.50,.70,1]){
     const frame=during(fraction),old=M.sample(frame.time,event.from,frame.evolutionAction);
     const arriving=M.sample(frame.time,event.to,frame.evolutionAction);
     for(const key of ['charge',spread,'burst'])close(old[key],arriving[key],'both wing skins share the evolution posture');
    }
    assert.ok(settling.every(frame=>frame.charge===0),'finished wings recover without another intake');
    const point=(u,v,frame,action)=>element==='光'
     ?M.point(u,v,frame.time,1,event.from,action)
     :M.point(u,v,frame.time,1,M.sample(frame.time,event.from,action));
    const early=during(.25),tip=point(.92,.65,early,early.evolutionAction);
    const restingTip=point(.92,.65,early,{weight:1,charge:0,release:0,burst:0});
    assert.ok(tip.x<restingTip.x-.01,'visible old wing contracts during early feathering');
    assert.ok(tip.y>restingTip.y+.01,'visible old trailing wing bends down during early feathering');
    for(const fraction of [0,.10,.25,.50,.70,1,1.5]){
     const frame=during(fraction),root=point(.5,element==='光'?.72:.43,frame,frame.evolutionAction);
     close(root.x,element==='光'?0:.5,'wing root remains attached to the magic core');
     close(root.y,element==='光'?0:.43,'wing root stays fixed vertically through opening');
    }
    for(const key of [spread,'burst']){
     assert.ok(forming.some(frame=>frame[key]>0&&frame[key]<peak[key]),key+' ramps up during formation');
     assert.ok(pose(-1/60)[key]<peak[key],key+' is still rising on the previous frame');
     assert.ok(settling.some(frame=>frame[key]>0&&frame[key]<peak[key]),key+' has a visible recovery');
     assert.ok(forming.every((frame,i)=>i===0||frame[key]>=forming[i-1][key]-1e-8),key+' rises once');
     assert.ok(settling.every((frame,i)=>i===0||frame[key]<=settling[i-1][key]+1e-8),key+' falls once');
     close(settling.at(-1)[key],0,key+' recovers before the next rank starts');
    }
    // Only this upgrade's particles can satisfy the check; S sparks can still
    // be on screen when the SS membrane or feathers finish forming.
    const current={...action,pulses:action.pulses.filter(pulse=>pulse.rank===event.to)};
    assert.equal(current.pulses.length,1,'a single emission accompanies this upgrade');
    assert.ok(M.particles(s.time,event.to,current).some(v=>v.star&&v.alpha>.05),
      'new burst stars visible on the peak frame for '+element+' '+event.to);
    const render=()=>({pose:M.sample(s.time,event.to,action),particles:M.particles(s.time,event.to,action)});
    const saved=render();
    M.sample(1e5,event.to,G.evolutionAction(1e5,result));M.particles(1e5,event.to,G.evolutionAction(1e5,result));
    assert.deepEqual(render(),saved,'pause/replay/scrubbing never duplicates or reschedules bursts');
    for(const age of [-1/60,0,1/60]){
     const before=pose(age-1e-5),after=pose(age+1e-5);
     for(const key of ['charge',spread,'burst'])assert.ok(Math.abs(before[key]-after[key])<.001,'continuous pose around formation '+key);
    }
   }
   const idle=G.evolutionAction(20,result);assert.equal(idle.weight,0);assert.equal(idle.pulses.length,0);
   for(const t of [0,5,20])if(!count){const a=G.evolutionAction(t,result);assert.equal(a.weight,0);assert.equal(a.pulses.length,0,'initial A remains its approved appearance');}
   assert.deepEqual(result,{type:'magic',element,rank,mana});
  }
 }
 console.log('PASS both rare wings reach peak spread and flash as each evolution finishes, preserve numeric results and clock, follow charge/spread/flash timing, retain stars and deterministic pause/replay.');
}finally{Math.random=random;Date.now=now;}
