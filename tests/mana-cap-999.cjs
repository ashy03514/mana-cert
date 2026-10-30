const assert=require('node:assert/strict');
for(const name of ['config','result-system','mana-scan','fire-scan-transition','water-rank-effects','wind-rank-effects','earth-rank-effects','light-rank-growth','dark-rank-growth','fire-rank-sparkles','fire-rank-embers'])require('../js/'+name+'.js');
const C=ManaConfig,R=ManaResults,F=FireScanTransition;
assert.deepEqual(C.ranks.S.range,[900,998]);assert.deepEqual(C.ranks.SS.range,[999,999]);
const boundaries=[[10,'E'],[199,'E'],[200,'D'],[349,'D'],[350,'C'],[549,'C'],[550,'B'],[749,'B'],[750,'A'],[899,'A'],[900,'S'],[998,'S'],[999,'SS']];
for(const [value,rank]of boundaries){assert.equal(R.rankForNumber(value),rank);assert.equal(F.rankForValue(value),rank);for(const e of [WaterRankEffects,WindRankEffects,EarthRankEffects])assert.equal(e.profileForValue(value).rank,rank);}
for(const element of Object.keys(C.elementWeights))for(const rank of ['E','D','C','B','A','S','SS']){
 if(['光','暗'].includes(element)&&!['A','S','SS'].includes(rank))continue;
 const weights=Object.fromEntries(Object.keys(C.normalRanks).map(k=>[k,k===rank?1:0]));
 const settings={elements:{[element]:true},muggleEnabled:false,muggleChance:0,normalRanks:weights,rareElementRanks:weights};
 for(const ticket of [0,.2,.5,.999999]){let draws=0;const result=R.createResult(settings,()=>++draws<3?.5:ticket);assert.equal(result.rank,rank);assert.ok(result.mana>=C.ranks[rank].range[0]&&result.mana<=C.ranks[rank].range[1]);assert.equal(result.mana===999,rank==='SS');assert.ok(Object.isFrozen(result));
  let prev=0;for(let t=0;t<6;t+=.05){const s=F.sample(t,result);assert.ok(s.value>=prev&&s.value<=999);prev=s.value;if(rank!=='SS')assert.notEqual(s.rank,'SS');}assert.equal(F.sample(10,result).value,result.mana);
 }
}
const ss=Object.freeze({element:'暗',rank:'SS',mana:999}),s=Object.freeze({element:'暗',rank:'S',mana:998});
for(const G of [LightRankGrowth,DarkRankGrowth]){assert.equal(G.sample(10,ss).growth,2);assert.equal(G.sample(10,ss).exposure,0);assert.equal(G.sample(10,s).growth,1);assert.equal(G.scan(10,ss).rank,'SS');assert.equal(G.scan(10,s).rank,'S');assert.deepEqual(G.timeline(ss).map(e=>e.to),['S','SS']);}
assert.equal(F.previewForElement('water').mana,999);assert.equal(F.sample(10,ss).power,3);
assert.ok(Math.abs(F.sample(4.05,ss).power-F.sample(4.049,ss).power)<.01,'SS fire does not pop at confirmation');
assert.equal(WaterRankEffects.sample(6,ss).profile.speed,1);assert.equal(WindRankEffects.sample(6,ss).profile.stormFlash,1);assert.equal(EarthRankEffects.sample(6,ss).weights[6],1);
assert.equal(WindRankEffects.sample(6,s).profile.stormFlash,0);
const box={x:0,y:0,width:300,height:400};assert.ok(FireRankEmbers.frames(390,844,{time:2,mana:999,box}).length>0);assert.equal(FireRankEmbers.frames(390,844,{time:2,mana:998,box}).length,0);
const scan=new ManaScan(ss,C.scan);for(let t=0;t<=4000;t+=20){scan.sample(t);assert.equal(typeof scan.value,'number');assert.ok(scan.value<=999);}assert.equal(scan.value,999);assert.equal(scan.rank,'SS');assert.equal(scan.warning,false);
console.log('PASS only 999 is SS: all result ranges/probabilities, unchanged E-A, S900-998, bounded scans, full six-element SS presentation and continuous fire confirmation.');
