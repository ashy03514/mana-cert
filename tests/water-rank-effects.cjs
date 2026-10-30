'use strict';
const assert=require('node:assert/strict');
require('../js/fire-scan-transition.js');
require('../js/water-rank-effects.js');
require('../js/water-ocean-reveal.js');
require('../js/fire-rank-sparkles.js');
const effects=WaterRankEffects;
const rows=[
  ['E',124,.3,.3,0,0,0,0,91.88289304403055],
  ['D',275,.4,.4,1,.18,0,0,133.02820882879823],
  ['C',450,.5,.5,1,.18,0,0,174.64611301663948],
  ['B',650,.6,.6,1,.5,0,0,217.9723641341288],
  ['A',825,.7,.7,1,.5,0,0,253.94163829787232],
  ['S',950,.8,1,1,1,.42,.65,319.203],
  ['SS',9999,1,1,1,1,1,1,385.245]
];
const box={x:11.55,y:92,width:366.9,height:366.9};
for(const [rank,mana,speed,waveScale,seaTexture,foamAmount,sprayDuty,starScale,diameter]of rows){
  const profile=effects.profileForValue(mana),result=Object.freeze({type:'magic',element:'水',rank,mana});
  for(const [key,value]of Object.entries({rank,speed,waveScale,seaTexture,foamAmount,sprayDuty,starScale}))assert.equal(profile[key],value,rank+' '+key);
  assert.ok(Object.isFrozen(profile),'profiles cannot be changed by rendering');
  assert.equal(profile.breakers,mana>=900?1:0,'only S and SS have travelling wave crests');
  const snapshot=JSON.stringify(result),end=effects.sample(8,result,1.2),later=effects.sample(9,result,1.2);
  assert.equal(end.value,mana);assert.equal(end.profile.rank,rank);
  assert.ok(Math.abs(later.time-end.time-speed)<1e-10,rank+' endpoint advances at its requested rate');
  assert.deepEqual(effects.sample(8,result,1.2),end,'seeking the same clock is deterministic');
  assert.equal(JSON.stringify(result),snapshot,'visual sampling leaves the committed result unchanged');
  assert.ok(Math.abs(effects.sample(0,result,1.2).time-.36)<1e-10,'formation joins the scan at E speed');
  const placement=WaterOceanReveal.placement(390,600,box,{waterPower:FireScanTransition.powerForValue(mana)});
  assert.ok(Math.abs(placement.diameter-diameter)<1e-8,rank+' keeps its pre-migration size');
  assert.ok(Math.abs(placement.rootY-396.527)<1e-8,'every rank keeps the original bottom anchor');
  const stars=FireRankSparkles.frames(390,600,{time:.7,mana,box,element:'water',sizeScale:profile.starScale});
  if(mana<900)assert.deepEqual(stars,[],'A and below have no rank glints');
  else{
    const full=FireRankSparkles.frames(390,600,{time:.7,mana,box,element:'water'});
    assert.ok(stars.length>0);assert.equal(stars.length,full.length);
    for(let i=0;i<stars.length;i++)assert.ok(Math.abs(stars[i].radius-full[i].radius*starScale)<1e-9,'water rank star sizing is applied');
  }
}
for(const [value,rank]of [[0,'E'],[199,'E'],[200,'D'],[349,'D'],[350,'C'],[549,'C'],[550,'B'],[749,'B'],[750,'A'],[899,'A'],[900,'S'],[999,'S'],[1000,'SS']]){
  assert.equal(effects.profileForValue(value).rank,rank,'rank boundary '+value);
  assert.equal(effects.profileForPower(FireScanTransition.powerForValue(value)).rank,rank,'power and mana profiles agree at '+value);
}
// Locate crossings using the production readout, independently of the effect
// clock's integration schedule. Both the material and its speed ease across it.
const ssResult=Object.freeze({type:'magic',element:'水',rank:'SS',mana:9999});
const transitionKeys=['speed','waveScale','seaTexture','foamAmount','breakers','starScale','sprayDuty','sprayGain','sprayFull'];
const near=(actual,expected,message,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,message+': '+actual+' versus '+expected);
function crossingAt(result,threshold){
  let lo=0,hi=FireScanTransition.timing.complete;
  for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(FireScanTransition.sample(mid,result).value<threshold)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
for(const threshold of [200,350,550,750,900,1000]){
  const crossing=crossingAt(ssResult,threshold),epsilon=1e-5;
  const before=effects.sample(crossing-epsilon,ssResult,1.2),after=effects.sample(crossing+epsilon,ssResult,1.2);
  assert.ok(after.time>=before.time&&after.time-before.time<=epsilon*2.01,'rank '+threshold+' has no animation phase jump');
  for(const key of transitionKeys)assert.ok(Math.abs(after.profile[key]-before.profile[key])<.0001,'rank '+threshold+' '+key+' blends without a jump');
  const earlier=effects.sample(crossing-epsilon*2,ssResult,1.2),later=effects.sample(crossing+epsilon*2,ssResult,1.2);
  const incoming=(before.time-earlier.time)/epsilon,outgoing=(later.time-after.time)/epsilon;
  near(incoming,outgoing,'rank '+threshold+' also keeps animation velocity continuous',.0001);
  for(const offset of [0,.65]){
    const a=effects.sample(crossing+offset-epsilon,ssResult,1.2),b=effects.sample(crossing+offset+epsilon,ssResult,1.2);
    // Probe the same phase of the spray pulse as well as the running clock.
    // In particular, its dark gap must not abruptly jump to full SS spray.
    for(const phase of [0,.03,.4,1.5,2.59])near(effects.sprayStrength(phase,a.profile),effects.sprayStrength(phase,b.profile),
      'rank '+threshold+' spray stays continuous at transition offset '+offset,.0002);
    near(effects.sprayStrength(a.time,a.profile),effects.sprayStrength(b.time,b.profile),
      'rank '+threshold+' animated spray stays continuous',.0002);
  }
}
// Exact-threshold final outcomes must finish their blend after the readout
// stops, rather than remain permanently halfway between their rank materials.
for(const mana of [200,350,550,750,900,1000]){
  const expected=effects.profileForValue(mana),result=Object.freeze({type:'magic',element:'水',rank:expected.rank,mana});
  const at=crossingAt(result,mana),snapshot=JSON.stringify(result);
  const entered=effects.sample(at+1e-7,result,1.2),settled=effects.sample(at+.65+1e-7,result,1.2);
  assert.equal(entered.profile.rank,expected.rank,'rank label updates immediately at the reached boundary');
  for(const key of ['speed','waveScale','seaTexture','foamAmount','breakers','starScale','sprayDuty']){
    near(settled.profile[key],expected[key],expected.rank+' settles to its exact specification after 0.65 s');
  }
  assert.deepEqual(effects.sample(at+.31,result,1.2),effects.sample(at+.31,result,1.2),'a paused transition repeats the same material');
  const tail=effects.sample(at+1.65+1e-7,result,1.2);
  near(tail.time-settled.time,expected.speed,expected.rank+' keeps the requested final speed after the blend');
  assert.equal(JSON.stringify(result),snapshot,'finishing a material blend cannot change the selected result');
}
const dResult=Object.freeze({type:'magic',element:'水',rank:'D',mana:200}),dAt=crossingAt(dResult,200);
const dEarly=effects.sample(dAt+.065,dResult),dMiddle=effects.sample(dAt+.325,dResult),dLate=effects.sample(dAt+.585,dResult);
assert.ok(dEarly.profile.seaTexture>0&&dEarly.profile.seaTexture<.1,'E to D begins by gently revealing the texture');
// The integer readout can round up to its endpoint a few nanoseconds before
// the analytic smoothstep endpoint; allow that precision in this midpoint.
near(dMiddle.profile.seaTexture,.5,'E to D reaches half of its texture blend halfway through',1e-7);
assert.ok(dLate.profile.seaTexture>.9&&dLate.profile.seaTexture<1,'E to D eases into its full texture');
let previous=-1;
for(let i=0;i<=500;i++){
  const t=i*.02,sample=effects.sample(t,ssResult,1.2);
  assert.equal(sample.value,FireScanTransition.sample(t,ssResult).value,'effects use the shown mana');
  assert.ok(sample.time>=previous,'the integrated visual clock never runs backwards');previous=sample.time;
  for(const key of transitionKeys)assert.ok(sample.profile[key]>=0&&sample.profile[key]<=1+1e-12,key+' remains bounded during overlapping transitions');
  if(sample.value<900){
    assert.equal(sample.profile.breakers,0,'large waves cannot appear before S');
    assert.equal(effects.sprayStrength(sample.time,sample.profile),0,'wave particles cannot appear before S');
    assert.equal(sample.profile.starScale,0,'rank stars cannot appear before S');
  }
}
const s=effects.profileForValue(950),ss=effects.profileForValue(9999),a=effects.profileForValue(825);
let active=0,off=0;
for(let i=0;i<1000;i++){
  const t=i*.026,strength=effects.sprayStrength(t,s);
  assert.ok(strength>=0&&strength<=1);
  if(strength>.01)active++;else off++;
  assert.equal(effects.sprayStrength(t,ss),1,'SS keeps the full continuous wave spray');
  assert.equal(effects.sprayStrength(t,a),0,'A and below never emit wave spray');
}
assert.ok(active>250&&active<500&&off>500,'S spray occupies shorter intervals with substantial quiet gaps');
assert.deepEqual(effects.sample(NaN,ssResult),effects.sample(0,ssResult));
console.log('Water ranks passed: E–SS profiles, immutable outcomes, original sizes, eased material/velocity continuity, 0.65 s settling, endpoint rates, short S spray and rank stars.');
