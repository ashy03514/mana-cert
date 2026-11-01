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
    const born=pose(0),charge=pose(.22),spreadPose=pose(.50),flash=pose(.40),recovered=pose(.95),p=M.profile(event.to);
    close(born.burst,0,'no release before the new silhouette is complete');
    close(charge.charge,p.charge,'short intake follows each completed silhouette');
    close(spreadPose[spread],p[spread],'each evolved wing makes a full rank-appropriate spread');
    close(flash.burst,p.burst,'each evolution has one bright release');
    close(recovered[spread],0,'release recovers before the next rank starts');
    const at=event.formedAt+.60,s=G.sample(at,result),action=s.evolutionAction,particles=M.particles(s.time,event.to,action);
    assert.ok(particles.some(v=>v.star&&v.alpha>.05),'burst stars accompany the spread for '+element+' '+event.to);
    const saved=JSON.stringify({pose:M.sample(s.time,event.to,action),particles});
    M.sample(1e5,event.to,G.evolutionAction(1e5,result));M.particles(1e5,event.to,G.evolutionAction(1e5,result));
    assert.equal(JSON.stringify({pose:M.sample(s.time,event.to,action),particles:M.particles(s.time,event.to,action)}),saved,'pause/replay/scrubbing never duplicates or reschedules bursts');
    const before=G.sample(event.formedAt-.001,result);
    assert.equal(before.evolutionAction.burst,0,'no burst during feathering');
    for(const at of [event.formedAt,event.formedAt+.22,event.formedAt+.50,event.formedAt+.95]){
     const a=G.sample(at-1e-5,result),b=G.sample(at+1e-5,result),one=M.sample(a.time,event.to,a.evolutionAction),two=M.sample(b.time,event.to,b.evolutionAction);
     for(const field of ['charge',spread,'burst'])assert.ok(Math.abs(one[field]-two[field])<.001,'continuous pose at action boundary '+field);
    }
   }
   const idle=G.evolutionAction(20,result);assert.equal(idle.weight,0);assert.equal(idle.pulses.length,0);
   for(const t of [0,5,20])if(!count){const a=G.evolutionAction(t,result);assert.equal(a.weight,0);assert.equal(a.pulses.length,0,'initial A remains its approved appearance');}
   assert.deepEqual(result,{type:'magic',element,rank,mana});
  }
 }
 console.log('PASS both rare wings release once after every completed evolution, preserve numeric results and clock, follow charge/spread/flash timing, retain stars and deterministic pause/replay.');
}finally{Math.random=random;Date.now=now;}
