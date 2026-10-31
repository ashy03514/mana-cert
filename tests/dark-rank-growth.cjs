'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/light-rank-growth.js');
require('../js/dark-rank-growth.js');
require('../js/dark-demon-wing-motion.js');
const G=DarkRankGrowth,M=DarkDemonWingMotion,T=FireScanTransition.timing;
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('Wing animation must not reroll the committed result');};
Date.now=()=>{throw Error('Wing animation must use the supplied active clock');};
try{
 for(const [rank,mana,final]of [['A',750,0],['A',899,0],['S',900,1],['S',998,1],['SS',999,2]]){
  const result=Object.freeze({type:'magic',element:'暗',rank,mana}),events=G.timeline(result);
  assert.equal(events.length,final);assert.ok(Object.isFrozen(events));
  assert.deepEqual(events.map(e=>[e.from,e.to]),[['A','S'],['S','SS']].slice(0,final));
  const birth=G.initial(0),formedBirth=G.initial(.8),baseInitial=LightRankGrowth.initial(.8);
  assert.deepEqual(birth.transition,{from:'A',to:'A',progress:0,birth:true},'initial A starts without an old wing beneath its reveal');
  assert.deepEqual(formedBirth,{...baseInitial,transition:{from:'A',to:'A',progress:1,birth:true}},'only the root-out birth transition changes the accepted initial schedule');
  let lastBirth=0;
  for(const at of [0,.1,.2,.4,.6,.8,1]){
   const pose=G.initial(at);assert.ok(pose.transition.progress>=lastBirth&&pose.transition.progress<=1,'initial front advances once from root to tips');
   assert.equal(pose.exposure,1,'birth keeps the violet veil until the silhouette finishes');
   assert.equal(pose.rank,'A');assert.equal(pose.growth,0);assert.equal(pose.time,LightRankGrowth.initial(at).time);
   lastBirth=pose.transition.progress;
  }
  assert.equal(G.initial(.4).transition.progress,.5);assert.equal(G.initial(.6,1.2).transition.progress,.5,'formation duration drives the reveal without independent timers');
  const handoff=G.sample(0,result,.8);assert.equal(formedBirth.time,handoff.time);assert.equal(formedBirth.exposure,handoff.exposure);assert.equal(handoff.transition.progress,1);
  assert.equal(G.initial(-1).transition.progress,0);assert.equal(G.initial(10).transition.progress,1);
  assert.equal(G.scan(.1,result).label,'闇能凝聚');
  let previous=G.sample(0,result,.8);
  for(let frame=1;frame<=600;frame++){
   const elapsed=frame/60,pose=G.sample(elapsed,result,.8),scan=G.scan(elapsed,result);
   assert.ok(pose.growth>=previous.growth&&pose.growth<=final,'growth never rewinds or overshoots');
   assert.ok(pose.time>previous.time&&pose.time-previous.time<=1/60+.000001,'integrated motion clock stays continuous');
   assert.ok(pose.time-previous.time>=.70/60-.000001,'every rank retains living idle motion');
   assert.ok(pose.exposure>=0&&pose.exposure<=1);
   assert.ok(['E','D','C','B','A','S','SS'].includes(scan.rank),'all visible numeric stages are valid ranks');
   assert.ok(scan.value>=FireScanTransition.sample(elapsed,result).value&&scan.value<=mana,'faster climb stays bounded by committed result');
   assert.deepEqual(pose,LightRankGrowth.sample(elapsed,result,.8),'formation and exposure follow the approved light method');
   assert.equal(pose.complete,elapsed>=pose.completeAt);
   previous=pose;
  }
  const finalPose=G.sample(10,result,.8);
  assert.equal(finalPose.growth,final);assert.equal(finalPose.rank,rank);assert.equal(finalPose.exposure,0);
  assert.equal(G.scan(T.complete,result).value,mana);assert.equal(G.scan(T.complete,result).rank,rank);
  for(let i=0;i<events.length;i++){
   const e=events[i];assert.ok(Object.isFrozen(e));
   const midpoint=G.sample(e.at+e.duration*.5,result),formed=G.sample(e.formedAt,result),settled=G.sample(e.completeAt,result);
   assert.equal(midpoint.exposure,1);assert.ok(midpoint.transition.progress>0&&midpoint.transition.progress<1);
   assert.deepEqual(formed.transition,{from:e.from,to:e.to,progress:1});assert.equal(formed.exposure,1,'new silhouette finishes before its bright light settles');
   assert.deepEqual(settled.transition,formed.transition);assert.equal(settled.exposure,0);
   assert.ok(e.completeAt>e.formedAt+.89);
   if(i)assert.ok(e.at>=events[i-1].completeAt+.099,'S is fully formed before SS starts');
  }
  const saved=G.sample(2.6,result);G.sample(1e6,result);assert.deepEqual(G.sample(2.6,result),saved,'replay does not depend on prior sampling');
  assert.deepEqual(result,{type:'magic',element:'暗',rank,mana});
 }
 for(const [w,h]of [[320,568],[390,844],[844,390],[1440,900]])for(const preview of [false,true]){
  const rest=G.layout(w,h,0,{preview}),shifted=G.layout(w,h,1,{preview}),b=rest.box;
  const artWidth=Math.min(b.width*.88,b.height*1.35),artHeight=artWidth*2/3;
  assert.ok(Math.abs(b.gatherY-(b.y+(b.height-artHeight)*.5+artHeight*.43))<1e-9,'gather ends at the dark wing root');
  assert.equal(shifted.box.gatherY,b.gatherY,'gather target does not move with the readout framing');
  assert.equal(shifted.box.width,b.width);assert.equal(shifted.box.height,b.height);
  assert.ok(shifted.box.x>=0&&shifted.box.x+shifted.box.width<=w);
  assert.ok(shifted.numbers.rankY<h&&shifted.numbers.labelY>0);
 }
 for(const rank of ['A','S','SS']){
  const profile=M.profile(rank);assert.equal(profile.rank,rank);assert.ok(Object.isFrozen(profile));
  for(const time of [0,.8,1.9,2.6,5.8,9.4,10000]){
   const pose=M.sample(time,rank);assert.equal(pose.time,time,'renderer supplies integrated speed; motion must not multiply it again');
   for(const side of [-1,1]){
    assert.deepEqual(M.point(.5,.43,time,side,pose),{x:.5,y:.43});
    for(const f of [0,1])assert.deepEqual(M.chainPoint(.35,.177,time,side,f,pose),M.point(.35,.177,time,side,pose),'chain endpoints remain attached at every rank');
   }
   for(const p of M.particles(time,rank)){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.size));
    assert.ok(p.alpha>=0&&p.alpha<=1&&p.size>0);
    if(rank==='A')assert.equal(p.star,false,'A has no high-rank starburst');
   }
  }
 }
 assert.ok(M.sample(1.9,'A').charge<M.sample(1.9,'S').charge&&M.sample(1.9,'S').charge<M.sample(1.9,'SS').charge);
 assert.ok(M.sample(2.6,'A').release<M.sample(2.6,'S').release&&M.sample(2.6,'S').release<M.sample(2.6,'SS').release);
 assert.equal(M.particles(2.6,'S').filter(p=>p.star).length,13);assert.equal(M.particles(2.6,'SS').filter(p=>p.star).length,22);
 for(let i=0;i<=540;i++){
  const time=i*.05;
  assert.deepEqual(M.sample(time),M.sample(time,'SS'),'standalone defaults still use the approved SS profile');
  assert.deepEqual(M.particles(time),M.particles(time,'SS'));
 }
 console.log('PASS dark rank growth: committed numeric results, A/S/SS formation plus exposure settlement, non-overlapping evolution, continuous supplied clock, registered root layouts, rank articulation/particles and SS default compatibility.');
}finally{Math.random=random;Date.now=now;}
