const assert=require('node:assert/strict');
require('../js/config.js');require('../js/probability-settings.js');require('../js/result-system.js');
let ranks=Object.fromEntries(Object.entries(ManaConfig.normalRanks).map(([k,v])=>[k,Math.round(v*100)]));
for(const code of Object.keys(ranks))for(let value=0;value<=100;value++){
  ranks=ProbabilitySettings.redistribute(ranks,code,value);
  assert.equal(ranks[code],value);assert.equal(Object.values(ranks).reduce((a,b)=>a+b),100);
  assert.ok(Object.values(ranks).every(n=>Number.isInteger(n)&&n>=0));
}
const onlyE=Object.fromEntries(Object.keys(ranks).map(k=>[k,k==='E'?100:0]));
const base={elements:{火:true},muggleEnabled:false,muggleChance:0,normalRanks:onlyE};
assert.equal(ManaResults.createResult(base,()=>0.99).rank,'E');
assert.equal(ManaResults.createResult({...base,elements:{光:true}},()=>0).rank,'A','light ignores ordinary rank slider');
assert.equal(ManaResults.createResult({...base,elements:{暗:true}},()=>0.99).rank,'SS');
assert.equal(ManaResults.validSettings({...base,normalRanks:{...onlyE,E:0}}),false);
console.log('Probability settings checks passed: exact 100% totals, edited percentage, ordinary draws and rare-element preservation.');
