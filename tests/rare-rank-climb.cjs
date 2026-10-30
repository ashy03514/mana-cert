'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');require('../js/light-rank-growth.js');require('../js/dark-rank-growth.js');
const F=FireScanTransition,start=F.timing.scanStart;
function crossing(sample,result,value){let lo=start,hi=6;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(sample(mid,result).value>=value)hi=mid;else lo=mid;}return hi;}
for(const [element,G]of [['光',LightRankGrowth],['暗',DarkRankGrowth]])for(const [rank,mana]of [['A',750],['A',899],['S',900],['S',998],['SS',999]]){
 const result=Object.freeze({type:'magic',element,rank,mana}),seen=new Set();let prior=0;
 assert.equal(G.scan(.3,result).rank,'E');
 for(let t=0;t<6;t+=.005){const scan=G.scan(t,result);assert.ok(scan.value>=prior&&scan.value<=mana);assert.equal(scan.rank,scan.value<10?'E':F.rankForValue(scan.value));seen.add(scan.rank);prior=scan.value;}
 for(const rank of ['E','D','C','B','A'])assert.ok(seen.has(rank));
 for(const value of [100,200,350,550,750]){
  const normal=crossing((t,r)=>F.sample(t,r),result,value)-start;
  const fast=crossing((t,r)=>G.scan(t,r),result,value)-start;
  assert.ok(Math.abs(normal/fast-1.5)<.00001,'each pre-A threshold is reached at 1.5x speed');
 }
 assert.equal(G.scan(6,result).value,mana);assert.equal(G.scan(6,result).rank,rank);
 assert.deepEqual(result,{type:'magic',element,rank,mana});
 assert.deepEqual(G.timeline(result).map(e=>[e.from,e.to]),[['A','S'],['S','SS']].slice(0,{A:0,S:1,SS:2}[rank]));
}
console.log('PASS light/dark E-D-C-B-A readouts, 1.5x early climb, monotonic values, unchanged final A/S/SS results and wing evolution.');
