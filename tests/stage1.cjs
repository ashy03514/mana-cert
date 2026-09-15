const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/probability-settings.js');
require('../js/result-system.js');
require('../js/magic-interaction.js');
require('../js/standby-magic.js');
require('../js/particle-renderer.js');
require('../js/resonance.js');
require('../js/ritual-renderer.js');
require('../js/element-effects.js');
require('../js/mana-scan.js');
require('../js/runtime.js');
require('../js/audio.js');
const C = {...ManaConfig}, R = ManaResults;
const settings = { elements:Object.fromEntries(Object.keys(C.elementWeights).map(k=>[k,true])), muggleEnabled:true, muggleChance:0.08 };
function rng(values) { let i=0; return () => { assert.ok(i<values.length,'unexpected additional random draw'); return values[i++]; }; }
assert.deepEqual(R.createResult(settings,rng([0.079,0])),{type:'muggle',element:null,rank:'MUGGLE',mana:1});
assert.equal(R.createResult(settings,rng([0,0.999999])).mana,9);
assert.equal(R.createResult(settings,rng([0.08,0,0.999,0])).rank,'E');
assert.equal(R.createResult(settings,rng([0.08,0,0.999,0])).mana,10);
for(const element of Object.keys(C.elementWeights)) {
  const single = {...settings,muggleEnabled:false,elements:{[element]:true}};
  const weights = element==='光'||element==='暗' ? C.rareElementRanks : C.normalRanks;
  let offset=0;
  for(const [rank,weight] of Object.entries(weights)) {
    for(const edge of [0,0.999999]) {
      const result=R.createResult(single,rng([0,offset+weight/2,edge]));
      assert.equal(result.element,element); assert.equal(result.rank,rank);
      assert.equal(result.mana,C.ranks[rank].range[edge===0?0:1]);
      assert.ok(Object.isFrozen(result));
    }
    offset+=weight;
  }
}
assert.equal(R.validSettings({...settings,elements:{}}),false);
assert.equal(R.validSettings({...settings,elements:{},muggleChance:1}),true);
assert.equal(R.validSettings({...settings,muggleChance:NaN}),false);
assert.throws(()=>R.createResult({...settings,elements:{}}));
for(const [n,rank] of [[1,'E'],[199,'E'],[200,'D'],[350,'C'],[550,'B'],[750,'A'],[900,'S'],[9999,'S']]) assert.equal(R.rankForNumber(n),rank);
const session = new R.Session();
session.begin(settings,rng([0,0.6])); const result=session.currentResult;
for(const state of ['INTERACTION','RESONANCE_COMPLETE','GATHER','ELEMENT_REVEAL','MANA_SCAN','RANK_CONFIRM','RESULT']) session.transition(state);
assert.equal(session.currentResult,result); assert.throws(()=>session.transition('INTERACTION'));
session.reset(); assert.equal(session.currentResult,null); assert.equal(session.state,'SETTINGS');

// Execute the real page script with a minimal DOM/clock: no browser or device launched.
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements=new Map(); let time=0, id=0;
const timers=new Map(), rafs=new Map();
const context2d=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  for(const arg of args) if(typeof arg==='number') assert.ok(Number.isFinite(arg),'finite canvas coordinates: '+key);
}});
function element(name) {
  if(!elements.has(name)) {
    const classes=new Set();
    elements.set(name,{style:{setProperty(){}},dataset:{},checked:true,value:'',textContent:'',className:'',
      classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);},toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);}},
      handlers:{}, addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(){},getContext(){return context2d;},
      getBoundingClientRect(){return {left:0,top:0,width:390,height:844};},setPointerCapture(){},releasePointerCapture(){}});
  }
  return elements.get(name);
}
const globalHandlers={};
let field;
class ObservedField extends MagicField { constructor(...args){super(...args);field=this;} }
let pageSession;
class ObservedSession extends R.Session { constructor(){super();pageSession=this;} }
let pageResonance;
class ObservedResonance extends Resonance { constructor(...args){super(...args);pageResonance=this;} }
const documentHandlers={};
const sandbox={ActiveTimeline,AdaptiveQuality,AudioManager,optionalVibrate,ManaConfig:C,ManaResults:{...R,Session:ObservedSession},MagicField:ObservedField,MagicRenderer,Resonance:ObservedResonance,RitualRenderer,ElementEffects,ManaScan,console,Math,innerWidth:390,innerHeight:844,devicePixelRatio:3,
  performance:{now:()=>time},navigator:{},document:{hidden:false,addEventListener:(type,fn)=>{documentHandlers[type]=fn;},createElement:()=>({getContext:()=>context2d}),getElementById:element,documentElement:element('root'),body:element('body')},
  setTimeout(fn,delay){assert.ok(!(this instanceof ActiveTimeline),'browser timer cannot use timeline receiver');timers.set(++id,{fn,at:time+delay});return id;},clearTimeout(n){assert.ok(!(this instanceof ActiveTimeline),'browser cancel cannot use timeline receiver');timers.delete(n);},
  requestAnimationFrame(fn){rafs.set(++id,fn);return id;},cancelAnimationFrame(n){rafs.delete(n);},
  addEventListener(type,fn){globalHandlers[type]=fn;}};
sandbox.window=sandbox;
sandbox.StandbyMagic=StandbyMagic;
sandbox.ProbabilitySettings=ProbabilitySettings;
// Renderer uses the page's document to build its three cached textures.
global.document=sandbox.document;
vm.createContext(sandbox);vm.runInContext(script,sandbox);
function click(name){element(name).handlers.click({preventDefault(){}});}
function tick(ms){const end=time+ms;while(time<end){time+=16;for(const [key,t] of [...timers])if(t.at<=time){timers.delete(key);t.fn();}const frames=[...rafs];rafs.clear();for(const [,fn]of frames)fn(time);}}
function touch(type,pointerId=1,x=130,y=440){const event={pointerId,clientX:x,clientY:y,preventDefault(){}};(type==='pointerdown'?element('animLayer').handlers[type]:globalHandlers[type])(event);}
element('s_master').checked=false;element('s_master').handlers.change(); assert.equal(element('btnStart').disabled,true);
element('s_muggle').checked=true;element('s_muggle').handlers.change();
element('muggleChance').value='100';element('muggleChance').handlers.input();
assert.equal(element('btnStart').disabled,false);
assert.equal(C.interactionPreview,true);
click('btnStart');touch('pointerdown');tick(60000);
assert.equal(element('body').dataset.state,'INTERACTION','preview stays interactive after one minute held');
touch('pointerup');tick(60000);
assert.equal(element('body').dataset.state,'INTERACTION','preview stays interactive after release');
assert.equal(field.gathering,false);
click('btnGoHome');C.interactionPreview=false; // Exercise the preserved certification mode below.
click('btnStart'); assert.equal(element('body').dataset.state,'STANDBY');
const roundResult=pageSession.currentResult;
tick(6000);assert.equal(element('body').dataset.state,'STANDBY','waits for first touch');
const interactionStart=time;
touch('pointerdown');touch('pointerdown',2);touch('pointerup',2);
assert.equal(field.pointer.id,1,'secondary pointer cannot release primary');
touch('pointermove',2,350,800);assert.equal(field.pointer.x,130);
tick(100);touch('pointermove',1,350,440);tick(100);
assert.ok(field.pointer.speed>0);
const realRandom=Math.random;
Math.random=()=>{throw Error('gestures must not sample random outcomes');};
try{touch('pointermove',1,120,500);tick(100);}finally{Math.random=realRandom;}
touch('pointerup');tick(2300);assert.equal(element('body').dataset.state,'INTERACTION','release must not fail or restart');
touch('pointerdown',3,100,200);tick(100);touch('pointercancel',3);
assert.equal(field.pointer.id,null);
while(element('body').dataset.state==='INTERACTION' && time-interactionStart<6200)tick(16);
assert.equal(element('body').dataset.state,'RESONANCE_COMPLETE');
assert.ok(time-interactionStart>=C.timing.interactionMin&&time-interactionStart<=C.timing.interactionMax+16,'bounded resonance time from first touch');
touch('pointerdown');assert.equal(field.pointer.id,null,'system owns magic after interaction');
const frozen=field.particles.map(p=>[p.x,p.y]);
tick(160);assert.equal(element('body').dataset.state,'RESONANCE_COMPLETE','completion has a real pause');
assert.deepEqual(field.particles.map(p=>[p.x,p.y]),frozen,'same particles freeze during pause');
tick(32);assert.equal(element('body').dataset.state,'GATHER');
tick(4000);
assert.equal(element('body').dataset.state,'RESULT');
assert.equal(pageSession.currentResult,roundResult,'gestures and reveal keep the preselected result');
assert.equal(element('attrPill').textContent,'無屬性');assert.equal(element('rankBadge').textContent,'麻瓜');
assert.ok(Number(element('manaValue').textContent)>=1&&Number(element('manaValue').textContent)<=9);
const saved=element('manaValue').textContent;tick(35000);assert.equal(element('manaValue').textContent,saved);
click('btnRetryCert');assert.equal(element('body').dataset.state,'STANDBY');
assert.notEqual(pageSession.currentResult,roundResult,'staff retry starts a new round');
assert.equal(element('resultCard').classList.contains('show'),false);
assert.equal(field.pointer.id,null);assert.equal(field.gathering,false);
assert.ok(field.trails.every(t=>t.life===0));
assert.equal(pageResonance.value,0);assert.equal(pageResonance.complete,false);
// Capture loss / blur and rotation clear control but do not fail the round.
touch('pointerdown',7);element('animLayer').handlers.lostpointercapture({pointerId:7});
assert.equal(field.pointer.id,null);assert.equal(element('body').dataset.state,'INTERACTION');
touch('pointerdown',8);globalHandlers.blur();assert.equal(field.pointer.id,null);
touch('pointerdown',9);sandbox.innerWidth=844;sandbox.innerHeight=390;globalHandlers.resize();
assert.equal(field.pointer.id,null);assert.equal(field.width,844);assert.equal(field.height,390);
sandbox.innerWidth=390;sandbox.innerHeight=844;globalHandlers.resize();
click('btnGoHome');assert.equal(element('body').dataset.state,'SETTINGS');
tick(8000);assert.equal(element('body').dataset.state,'SETTINGS','reset cancels in-flight interaction timers');
assert.equal(element('muggleChance').value,'100');
for(const abortState of ['RESONANCE_COMPLETE','GATHER']) {
  click('btnStart');touch('pointerdown');
  const start=time;
  while(element('body').dataset.state!==abortState&&time-start<7500)tick(16);
  assert.equal(element('body').dataset.state,abortState);
  click('btnGoHome');tick(8000);
  assert.equal(element('body').dataset.state,'SETTINGS','aborting '+abortState+' cancels every scheduled transition');
  assert.equal(timers.size,0);assert.equal(pageResonance.value,0);assert.equal(field.gathering,false);
}
// Deterministic normal, light, dark, and SS runs use the actual page animation.
for(const [attr,rank,ticket] of [['火','E',0.999],['水','B',0.4],['風','C',0.6],['土','D',0.8],['光','A',0],['暗','S',0.7],['火','SS',0]]) {
  element('s_master').checked=false;element('s_master').handlers.change();
  const control={火:'fire',水:'water',風:'wind',土:'earth',光:'light',暗:'dark'}[attr];
  element('s_'+control).checked=true;element('s_'+control).handlers.change();
  element('s_muggle').checked=false;element('s_muggle').handlers.change();
  const original=Math.random;Math.random=rng([0,ticket,0.5]);
  try{click('btnStart');}finally{Math.random=original;}
  touch('pointerdown');tick(100);touch('pointerup');
  const revealWait=time;
  while(element('body').dataset.state!=='ELEMENT_REVEAL'&&time-revealWait<8000)tick(16);
  assert.equal(element('body').dataset.state,'ELEMENT_REVEAL');
  sandbox.document.hidden=true;documentHandlers.visibilitychange();tick(10000);
  assert.equal(element('body').dataset.state,'ELEMENT_REVEAL','hidden page does not advance reveal timers');
  sandbox.document.hidden=false;documentHandlers.visibilitychange();
  assert.equal(element('elementRevealScene').hidden,true);
  assert.equal(element('resultCard').classList.contains('show'),false,'rank and score are hidden during element scene');
  tick(C.elementReveal.titleAt+16);
  assert.equal(element('elementRevealTitle').textContent,attr+'屬性');
  assert.equal(element('elementRevealScene').hidden,false);
  tick(1200);assert.equal(element('body').dataset.state,'ELEMENT_REVEAL','element text has its own readable beat');
  tick(250);assert.equal(element('body').dataset.state,'MANA_SCAN');
  const pausedValue=element('manaValue').textContent;
  sandbox.document.hidden=true;documentHandlers.visibilitychange();tick(10000);
  assert.equal(element('manaValue').textContent,pausedValue,'background scan is frozen');
  sandbox.document.hidden=false;documentHandlers.visibilitychange();
  assert.equal(element('remark').textContent,'','final comment does not spoil the scan');
  assert.equal(element('elementRevealScene').hidden,true);
  const scoreHistory=[],rankHistory=[];let warned=false;
  const scanStart=time;
  while(element('body').dataset.state==='MANA_SCAN'&&time-scanStart<4500){
    scoreHistory.push(element('manaValue').textContent);rankHistory.push(element('rankBadge').textContent);
    warned ||= element('resultCard').classList.contains('overflow');tick(16);
  }
  assert.equal(element('body').dataset.state,'RANK_CONFIRM');
  if(rank==='SS'){
    assert.ok(warned);assert.ok(scoreHistory.includes('9999'));assert.ok(scoreHistory.includes('????'));
    assert.equal(element('scanStatus').textContent,C.resultText.unknown);
  }else assert.equal(warned,false);
  assert.equal(element('resultCard').classList.contains('overflow'),false);
  tick(1100);
  assert.equal(element('body').dataset.state,'RESULT');
  assert.equal(element('rankBadge').textContent,rank);
  assert.equal(element('attrPill').textContent,attr+'屬性');
  if(rank==='SS')assert.equal(element('manaValue').textContent,'????');
  assert.equal(timers.size,0);assert.equal(rafs.size,2,'only the two existing visual loops survive');
  click('btnGoHome');
}
for(const elapsed of [0,650]) {
  click('btnStart');touch('pointerdown');touch('pointerup');
  const start=time;
  while(element('body').dataset.state!=='ELEMENT_REVEAL'&&time-start<8000)tick(16);
  assert.equal(element('body').dataset.state,'ELEMENT_REVEAL');tick(elapsed);
  click('btnGoHome');tick(4000);
  assert.equal(element('body').dataset.state,'SETTINGS');
  assert.equal(element('elementRevealScene').hidden,true);
  assert.equal(element('elementRevealTitle').textContent,'');assert.equal(timers.size,0);
}
const sw=fs.readFileSync('service-worker.js','utf8');
element('s_master').checked=true;element('s_master').handlers.change();
for(const key of ['fire','water','wind','earth','light','dark','muggle'])assert.equal(element('s_'+key).checked,true);
element('s_fire').checked=false;element('s_fire').handlers.change();assert.equal(element('s_master').checked,false);

element('chance_E').value='100';element('chance_E').handlers.input();
assert.equal(element('percent_E').textContent,'100%');
assert.equal(element('chance_SS').value,0);
element('s_master').checked=false;element('s_master').handlers.change();element('s_fire').checked=true;element('s_fire').handlers.change();
click('btnStart');assert.equal(pageSession.currentResult.rank,'E','slider settings reach the actual round draw');
click('btnGoHome');assert.equal(element('chance_E').value,100,'settings survive returning home');
element('s_muggle').checked=false;element('s_muggle').handlers.change();assert.equal(element('muggleChance').disabled,true);
assert.equal(element('v_muggle').textContent,'關');
assert.ok(sw.includes('./js/probability-settings.js'));
const toggledBefore=element('s_fire').checked;
click('restoreProbabilities');
assert.equal(Number(element('muggleChance').value),8);
for(const [k,v]of Object.entries(C.normalRanks))assert.equal(Number(element('chance_'+k).value),Math.round(v*100));
assert.equal(element('s_muggle').checked,false,'restore does not change switches');
assert.equal(element('s_fire').checked,toggledBefore);

for(const asset of [...sw.matchAll(/"(\.\/[^"\n]+)"/g)].map(x=>x[1]))assert.ok(fs.existsSync(asset),asset);
for(const name of ['config','result-system','magic-interaction','particle-renderer','resonance','ritual-renderer','element-effects','mana-scan','runtime','audio','pwa'])assert.ok(sw.includes('./js/'+name+'.js'));
JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
delete global.document;
console.log('Page regression checks passed: random boundaries, ranks, free-touch flows, reset, PWA assets.');
