'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.MANA_TEST_ROOT||path.resolve(__dirname,'..');
const context={};context.globalThis=context;vm.createContext(context);
for(const name of ['config','result-system','cert-settings','fire-scan-transition','result-layout']){
 let file=path.join(root,'js',name+'.js');
 if(!fs.existsSync(file)&&process.env.MANA_TEST_FALLBACK)file=path.join(process.env.MANA_TEST_FALLBACK,'js',name+'.js');
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const {ManaConfig:C,ManaResults:R,CertSettings:Settings,FireScanTransition:Scan,ResultLayout:Layout}=context;
const keys=Object.keys(C.elementWeights),ranks=['E','D','C','B','A','S','SS'];
const settings={elements:Object.fromEntries(keys.map(k=>[k,k==='雷'])),normalRanks:{...C.normalRanks},rareElementRanks:{...C.rareElementRanks},muggleEnabled:false,muggleChance:0};
assert.ok(C.elementWeights.雷>0);assert.equal(C.elementWeights.雷,C.elementWeights.火);
for(const rank of ranks){
 settings.normalRanks=Object.fromEntries(ranks.map(k=>[k,k===rank?100:0]));
 for(const randomValue of [0,.5,.999999]){
  const session=new R.Session(),result=session.begin(settings,()=>randomValue);
  assert.equal(result.element,'雷');assert.equal(result.rank,rank);assert.ok(Object.isFrozen(result));
  const [min,max]=C.ranks[rank].range;assert.ok(result.mana>=min&&result.mana<=max);
  const end=Scan.sample(10,result);assert.equal(end.value,result.mana);assert.equal(end.rank,rank);assert.equal(end.complete,true);
  assert.equal(session.currentResult,result);assert.ok(result.mana<=999);
 }
}
settings.normalRanks=Object.fromEntries(ranks.map(k=>[k,0]));assert.equal(R.validSettings(settings),false);
assert.throws(()=>R.createResult(settings));
settings.normalRanks={...C.normalRanks};settings.elements.雷=false;
assert.equal(R.validSettings(settings),false);
settings.elements.火=true;for(let i=0;i<100;i++)assert.equal(R.createResult(settings,()=>i/100).element,'火');
const defaults={elements:Object.fromEntries(keys.map(k=>[k,true])),normalRanks:Object.fromEntries(Object.entries(C.normalRanks).map(([k,v])=>[k,Math.round(v*100)])),rareElementRanks:{A:60,S:30,SS:10},muggleEnabled:true,mugglePercent:8,soundEnabled:true,hapticsEnabled:true};
assert.equal(Settings.normalize(null,defaults).elements.雷,true);
const legacy={...defaults,elements:Object.fromEntries(keys.filter(k=>k!=='雷').map(k=>[k,k==='風']))};
assert.equal(Settings.normalize(legacy,defaults).elements.雷,false);
assert.equal(Settings.normalize(legacy,defaults).elements.風,true);
legacy.elements=Object.fromEntries(Object.keys(legacy.elements).map(k=>[k,true]));
assert.equal(Settings.normalize(legacy,defaults).elements.雷,true);
const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
const saved={...defaults,elements:{...defaults.elements,雷:false}};
Settings.save(storage,saved);assert.deepEqual(JSON.parse(JSON.stringify(Settings.load(storage,defaults))),saved);
saved.elements.雷=true;Settings.save(storage,saved);assert.equal(Settings.load(storage,defaults).elements.雷,true);
const w=390,h=844,box={x:0,y:0,width:w,height:h*.68,gatherY:h*.68*.76};
const base=Scan.layout(w,h,box,1);base.box.gatherY=base.box.y+base.box.height*.76;
const layout=Layout.compose(w,h,base,{element:'lightning',buttonTop:760});
assert.equal(layout.box.width,box.width);assert.equal(layout.box.height,box.height);
assert.ok(layout.composition.envelope.bottom<layout.composition.titleTop);
assert.ok(Math.abs(layout.box.gatherY-(layout.box.y+layout.box.height*.76))<1e-9);
console.log('PASS lightning E-SS outcomes, disabled selection, immutable scans, settings migration/persistence and result layout');
