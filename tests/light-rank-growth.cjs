'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/light-rank-growth.js');
const G=LightRankGrowth,timing=FireScanTransition.timing;
const random=Math.random,now=Date.now;
Math.random=()=>{throw Error('growth must not reroll certification');};
Date.now=()=>{throw Error('growth must use its supplied clock');};
try{
  for(const [rank,mana,final] of [['A',750,0],['A',899,0],['S',900,1],['S',999,1],['SS',1000,2],['SS',9999,2]]){
    const result=Object.freeze({type:'magic',element:'光',rank,mana});
    const start=G.sample(0,result,.8);
    assert.equal(start.growth,0);assert.ok(Math.abs(start.time-.56)<1e-12);assert.equal(start.starMana,0);
    assert.deepEqual(G.initial(.8),{value:0,rank:'A',growth:0,time:.8*.70,starMana:0,
      transition:{from:'A',to:'A',progress:1},exposure:1,phase:'forming',complete:false});
    assert.equal(start.exposure,1);assert.deepEqual(start.transition,{from:'A',to:'A',progress:1});
    assert.equal(G.sample(.9,result).exposure,0,'initial A color settles before the first growth');
    let prior=start,maxGrowthStep=0;
    for(let step=1;step<=1000;step++){
      const time=step*.01,next=G.sample(time,result,.8),scan=G.scan(time,result);
      assert.ok(next.growth>=prior.growth&&next.growth<=final);
      assert.ok(next.time>prior.time);assert.ok(next.time-prior.time<=.010001);
      assert.ok(next.time-prior.time>=.006999);
      assert.ok(next.starMana>=prior.starMana&&next.starMana<=1000);
      assert.ok(next.exposure>=0&&next.exposure<=1);
      assert.ok(next.transition.progress>=0&&next.transition.progress<=1);
      assert.equal(next.complete,time>=next.completeAt);
      assert.ok(['—','A','S','SS'].includes(scan.rank));
      maxGrowthStep=Math.max(maxGrowthStep,next.growth-prior.growth);prior=next;
      assert.equal(scan.value,FireScanTransition.sample(time,result).value,'uses committed numeric scan');
      for(const field of ['growth','time','starMana'])assert.ok(Math.abs(G.sample(time+1e-6,result,.8)[field]-next[field])<.002,'continuous '+field);
    }
    assert.ok(maxGrowthStep<.016,'each growth stage occupies real time');
    const completeAt=G.sample(0,result).completeAt;
    assert.ok(completeAt>=timing.complete);
    assert.ok(completeAt<=5.36,'visual finish stays close to unchanged numeric endpoint');
    assert.equal(G.sample(completeAt,result,.8).growth,final,'full final shape survives color settlement');
    assert.equal(G.sample(completeAt,result,.8).rank,rank);
    assert.equal(G.sample(completeAt,result,.8).exposure,0);
    assert.equal(G.sample(completeAt,result,.8).complete,true);
    assert.equal(G.sample(completeAt-.00001,result,.8).complete,false);
    assert.equal(G.scan(timing.complete,result).rank,rank);
    assert.equal(G.scan(timing.complete,result).value,mana);
    assert.equal(G.scan(timing.complete,result).complete,true,'numeric result timing remains unchanged');
    const events=G.timeline(result);
    assert.ok(Object.isFrozen(events));assert.equal(events.length,final);
    for(let i=0;i<events.length;i++){
      const event=events[i];assert.ok(Object.isFrozen(event));
      assert.ok(event.duration>=1.1);assert.ok(Math.abs(event.completeAt-event.formedAt-.9)<1e-9);
      const before=G.sample(event.formedAt-1e-6,result),formed=G.sample(event.formedAt,result),middle=G.sample(event.formedAt+.45,result),done=G.sample(event.completeAt,result);
      assert.ok(before.transition.progress<1);assert.equal(before.exposure,1,'no early exposure fade');
      assert.deepEqual(formed.transition,{from:event.from,to:event.to,progress:1});assert.equal(formed.exposure,1,'full silhouette remains brightly exposed');
      assert.deepEqual(middle.transition,formed.transition);assert.ok(Math.abs(middle.exposure-.5)<1e-9);
      assert.deepEqual(done.transition,formed.transition);assert.equal(done.exposure,0);
      assert.equal(done.growth,i+1);
      if(i){
        const previous=events[i-1];assert.ok(event.at>=previous.completeAt+.0999,'prior color settles before the next growth');
        const hold=G.sample(event.at-.00001,result),next=G.sample(event.at,result);
        assert.deepEqual(hold.transition,{from:previous.from,to:previous.to,progress:1});assert.equal(hold.exposure,0);
        assert.deepEqual(next.transition,{from:event.from,to:event.to,progress:0});assert.equal(next.exposure,1);
        assert.equal(hold.growth,next.growth,'new exposure only affects the not-yet-visible target, never the old feathers');
      }
    }
    const snapshot=G.sample(2.5,result,.8);G.sample(100000,result,.8);assert.deepEqual(G.sample(2.5,result,.8),snapshot);
    assert.deepEqual(result,{type:'magic',element:'光',rank,mana});
  }
  assert.equal(G.scan(.1,{element:'光',mana:9999,rank:'SS'}).label,'聖光凝聚');
  for(const [w,h] of [[320,568],[390,844],[844,390],[1440,900]]){
    const start=G.layout(w,h,0),end=G.layout(w,h,1),n=end.numbers;
    assert.ok(end.box.x>=0&&end.box.y>=0&&end.box.x+end.box.width<=w);
    assert.ok(end.box.y+end.box.height<=h);
    assert.ok(n.x>0&&n.x<w&&n.labelY-28>0&&n.rankY<h-70);
    assert.equal(start.box.width,end.box.width);assert.equal(start.box.height,end.box.height);
    assert.equal(start.box.gatherY,end.box.gatherY,'root target does not chase numeric shift');
    assert.ok(end.box.y<=start.box.y);
  }
  console.log('PASS formal light growth: immutable numeric scan, A/S/SS separate formation and .9s color settle, stable explicit transition pairs, no overlapping upgrades, completion gate, continuous clock, fixed root/layouts.');
}finally{Math.random=random;Date.now=now;}
