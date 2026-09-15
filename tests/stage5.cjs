const assert=require('node:assert/strict');
require('../js/config.js');require('../js/result-system.js');require('../js/mana-scan.js');
const c=ManaConfig.scan;
for(const rank of ['E','D','C','B','A','S'])for(const target of ManaConfig.ranks[rank].range){
  const result=Object.freeze({rank,mana:target}),scan=new ManaScan(result,c);
  let previous=0;
  for(let t=0;t<=c.duration;t+=10){
    scan.sample(t);assert.ok(scan.value>=previous&&scan.value<=target);
    assert.equal(scan.rank,ManaResults.rankForNumber(scan.value));assert.equal(scan.warning,false);
    assert.equal(scan.done,t===c.duration);previous=scan.value;
  }
  assert.equal(scan.value,target);assert.equal(scan.rank,rank);assert.equal(scan.result,result);
}
const scan=new ManaScan(Object.freeze({rank:'SS',mana:1000}),c),seen=[];
let n=0;
for(let t=0;t<=3100;t+=10){scan.sample(t);if(typeof scan.value==='number'){assert.ok(scan.value>=n);n=scan.value;}
  if(!seen.includes(scan.rank))seen.push(scan.rank);
}
assert.deepEqual(seen,['E','D','C','B','A','S','SS']);
scan.sample(1799);assert.equal(scan.warning,false);
scan.sample(1800);assert.equal(scan.value,1000);assert.equal(scan.warning,true);assert.equal(scan.rank,'S');
scan.sample(2700);assert.equal(scan.value,9999);assert.equal(scan.rank,'S');assert.equal(scan.done,false);
scan.sample(2880);assert.equal(scan.value,'????');assert.equal(scan.rank,'S');assert.equal(scan.done,false);
scan.sample(3100);assert.equal(scan.value,'????');assert.equal(scan.rank,'SS');assert.equal(scan.done,true);
console.log('Stage 5 checks passed: all rank boundaries, monotonic scores, duration, SS warning / 9999 / unknown / confirmation.');
