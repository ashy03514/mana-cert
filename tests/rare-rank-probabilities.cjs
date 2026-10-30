const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const env={};vm.createContext(env);for(const f of ['config','result-system'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),env);
const {ManaResults:R,ManaConfig:C}=env;
for(const element of Object.keys(C.elementWeights))for(const rank of ['A','S','SS']){
  const weights=Object.fromEntries(Object.keys(C.normalRanks).map(k=>[k,k===rank?100:0]));
  for(const ticket of [0,.2,.59,.9,.999999]){
    const result=R.createResult({elements:{[element]:true},muggleEnabled:false,muggleChance:0,normalRanks:weights,rareElementRanks:weights},()=>ticket);
    assert.equal(result.rank,rank);assert.equal(result.element,element);assert.ok(Object.isFrozen(result));
    assert.ok(result.mana>=C.ranks[rank].range[0]&&result.mana<=C.ranks[rank].range[1]);
  }
}
for(const element of ['光','暗']){
  const settings={elements:{[element]:true},muggleEnabled:false,muggleChance:0,normalRanks:{E:100,D:0,C:0,B:0,A:0,S:0,SS:0},rareElementRanks:{A:0,S:30,SS:20}};
  for(const [ticket,rank] of [[0,'S'],[.59,'S'],[.6,'SS'],[.999,'SS']])assert.equal(R.createResult(settings,()=>ticket).rank,rank);
  for(const lower of ['E','D','C','B'])assert.equal(R.createResult({...settings,normalRanks:Object.fromEntries(Object.keys(C.normalRanks).map(k=>[k,k===lower?100:0]))},()=>.9).rank,'SS');
  assert.equal(R.validSettings({...settings,rareElementRanks:{A:0,S:0,SS:0}}),false);
  assert.equal(R.validSettings({...settings,normalRanks:{}}),true,'disabled basic distribution does not block rare');
  const legacy={...settings};delete legacy.rareElementRanks;assert.equal(R.createResult(legacy,()=>.3).rank,'A');assert.equal(R.createResult(legacy,()=>.75).rank,'S');
}
console.log('PASS configured rank probabilities: all elements obey A/S/SS 100%, rare eligible ratios normalize, A minimum and omitted-setting defaults retained.');
