'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.MANA_TEST_ROOT||path.resolve(__dirname,'..');
const env={};env.globalThis=env;vm.createContext(env);
for(const name of ['config','fire-scan-transition','lightning-rank-effects']){
 let file=path.join(root,'js',name+'.js');
 if(!fs.existsSync(file)&&process.env.MANA_TEST_FALLBACK)file=path.join(process.env.MANA_TEST_FALLBACK,'js',name+'.js');
 vm.runInContext(fs.readFileSync(file,'utf8'),env,{filename:file});
}
const L=env.LightningRankEffects,F=env.FireScanTransition,C=env.ManaConfig;
const period=4.4/1.5,hit=1.28,formation=.8,keys=Object.keys(L.forRank('SS')).filter(k=>k!=='rank');
for(const key of keys)assert.equal(L.forRank('SS')[key],1,'SS preserves original '+key);
for(const rank of ['E','D','C','B','A','S','SS']){
 const result=Object.freeze({type:'magic',element:'雷',rank,mana:C.ranks[rank].range[1]});
 const endpoint=L.sample(8,result,formation);
 for(const key of keys)assert.ok(Math.abs(endpoint.profile[key]-L.forRank(rank)[key])<1e-12,rank+' reaches '+key);
 let before=L.initial(formation);
 const records=[];
 for(let t=0;t<=12;t+=.01){
  const s=L.sample(t,result,formation);records.push(s);
  assert.ok(s.time>=before.time-1e-10,'motion clock never reverses');
  assert.ok(s.stormTime>=before.stormTime-1e-10,'strike schedule never reverses');
  for(const key of keys){assert.ok(Number.isFinite(s.profile[key]));assert.ok(s.profile[key]>=-1e-12&&s.profile[key]<=1+1e-12);}
  if(rank==='E'||rank==='D'){assert.equal(s.profile.skyStrength,0);assert.equal(s.stormTime,0);}
  if(t>.01){
   for(const key of keys)assert.ok(Math.abs(s.profile[key]-before.profile[key])<.025,'no abrupt transition in '+key);
   const cycle=Math.floor(s.stormTime/period),previousCycle=Math.floor(before.stormTime/period);
   if(result.mana>=350&&cycle===previousCycle){
    assert.equal(JSON.stringify(s.strikeProfile),JSON.stringify(before.strikeProfile),'one salvo retains its birth profile');
    assert.ok(Math.abs((s.impactAge-before.impactAge)-.01)<1e-8,'impact age uses real seconds');
   }
  }
  before=s;
 }
 for(const t of [5.1,.4,8.3,1.7,0,3.1]){
  const expected=L.sample(t,result,formation),again=L.sample(t,result,formation);
  assert.equal(JSON.stringify(expected),JSON.stringify(again),'seek/pause sampling deterministic');
 }
 assert.equal(result.mana,C.ranks[rank].range[1]);assert.ok(Object.isFrozen(result));
}
for(const time of [0,.5,1.28,1.33,2.9,3,6.5,99,1000]){
 const s=L.preview(time,'SS');assert.equal(s.time,time);assert.equal(s.stormTime,time);
 assert.equal(s.impactAge,time%period-hit);assert.equal(s.profile,L.forRank('SS'));
}
for(const rank of ['C','B','A','S']){
 const rate=L.forRank(rank).strikeRate,at=hit/rate;
 assert.ok(Math.abs(L.preview(at,rank).impactAge)<1e-10);
 assert.ok(Math.abs(L.preview(at+.12,rank).impactAge-.12)<1e-10,'preview descent/flash keeps real-time pacing');
}
const ss={mana:999,rank:'SS',element:'雷'};
let lo=0,hi=8;
for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(F.sample(mid,ss).value<350)lo=mid;else hi=mid;}
const firstSky=(lo+hi)/2+.45;
assert.ok(Math.abs(L.sample(firstSky,ss,formation).impactAge)<1e-7,'first impact is .45 seconds after numeric C');
assert.ok(Math.abs(L.sample(firstSky-.16,ss,formation).impactAge+.16)<1e-7);
const final=L.sample(2000,ss,formation);
assert.equal(final.profile.rank,'SS');assert.ok(Number.isFinite(final.time)&&Number.isFinite(final.impactAge));
// Evict schedule caches, then replay the same frame to verify pure output.
const saved=JSON.stringify(L.sample(3.8,ss,formation));
for(let mana=360;mana<400;mana++)L.sample(25,{mana},formation);
assert.equal(JSON.stringify(L.sample(3.8,ss,formation)),saved);
console.log('PASS lightning tiers, eased growth, integrated clocks, real-second salvos, fixed strike profiles, SS parity and deterministic replay');
