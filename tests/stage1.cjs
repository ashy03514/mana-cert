const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/probability-settings.js');
require('../js/result-system.js');
require('../js/portal-scene.js');
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

// Run the real page without launching a browser. Device appearance remains a manual check.
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const htmlIds=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const imports=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
for(const oldId of ['guideText','coreCanvas','fxCanvas','elementRevealScene'])assert.ok(!htmlIds.has(oldId),'retired visual node: '+oldId);
for(const oldModule of ['magic-interaction','standby-magic','particle-renderer','resonance','ritual-renderer','element-effects'])assert.ok(!imports.includes('./js/'+oldModule+'.js'),'retired renderer is not loaded: '+oldModule);
assert.ok(imports.includes('./js/portal-scene.js'));
let time=0,id=0,drawCalls=0,sandbox,portal,pageSession;
const timers=new Map(),rafs=new Map(),elements=new Map();
function eventTarget(extra={}){const target={handlers:{},...extra};target.addEventListener=(type,fn)=>{(target.handlers[type]??=[]).push(fn);};return target;}
function emit(target,type,event={}){assert.ok(target.handlers[type]?.length,'registered event: '+type);for(const fn of target.handlers[type])fn({preventDefault(){},...event});}
function makeContext(){
  const state={globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1,fillStyle:'#000',strokeStyle:'#000'},stack=[];
  const finite=(args,key)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),'finite Canvas '+key);};
  const gradient=(...args)=>{finite(args,'gradient');return {addColorStop(at,color){assert.ok(at>=0&&at<=1);assert.equal(typeof color,'string');}};};
  const methods={save(){stack.push({...state});},restore(){assert.ok(stack.length,'balanced Canvas restore');Object.assign(state,stack.pop());},createRadialGradient:gradient,createLinearGradient:gradient};
  return new Proxy(state,{get(target,key){if(key in methods)return methods[key];if(key in target)return target[key];return (...args)=>{finite(args,String(key));if(['drawImage','fill','fillRect'].includes(key))drawCalls++;};},
    set(target,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),'finite Canvas property '+String(key));if(key==='globalAlpha')assert.ok(value>=0&&value<=1,'bounded Canvas opacity: '+value);if(key==='lineWidth')assert.ok(value>0);target[key]=value;return true;}});
}
function makeElement(){
  const classes=new Set(),attrs=new Map(),context2d=makeContext(),captured=new Set();
  return eventTarget({style:{setProperty(name,value){this[name]=value;}},dataset:{},checked:true,value:'',textContent:'',className:'',
    classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);},toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);}},
    setAttribute(name,value){attrs.set(name,String(value));},getAttribute(name){return attrs.get(name)??null;},getContext(){return context2d;},
    getBoundingClientRect(){return {left:0,top:0,width:sandbox?.visualViewport.width??390,height:sandbox?.visualViewport.height??844};},
    setPointerCapture(pointerId){captured.add(pointerId);},releasePointerCapture(pointerId){captured.delete(pointerId);},hasPointerCapture(pointerId){return captured.has(pointerId);}
  });
}
function element(name){assert.ok(htmlIds.has(name),'actual DOM element exists: '+name);if(!elements.has(name))elements.set(name,makeElement());return elements.get(name);}
class ObservedPortal extends PortalScene {constructor(...args){super(...args);portal=this;}}
class ObservedSession extends R.Session {constructor(){super();pageSession=this;}}
sandbox=eventTarget({ActiveTimeline,AdaptiveQuality,AudioManager,optionalVibrate,ManaConfig:C,ManaResults:{...R,Session:ObservedSession},PortalScene:ObservedPortal,ProbabilitySettings,
  console,Math,innerWidth:390,innerHeight:844,devicePixelRatio:3,performance:{now:()=>time},navigator:{},visualViewport:eventTarget({width:390,height:844}),
  document:eventTarget({hidden:false,createElement:()=>makeElement(),getElementById:element,documentElement:makeElement(),body:makeElement()}),
  setTimeout(fn,delay){assert.ok(!(this instanceof ActiveTimeline),'browser timer receiver');timers.set(++id,{fn,at:time+delay});return id;},
  clearTimeout(n){assert.ok(!(this instanceof ActiveTimeline),'browser cancel receiver');timers.delete(n);},
  requestAnimationFrame(fn){rafs.set(++id,fn);return id;},cancelAnimationFrame(n){rafs.delete(n);}});
sandbox.window=sandbox;global.document=sandbox.document;
vm.createContext(sandbox);vm.runInContext(script,sandbox);
function click(name){emit(element(name),'click');}
function change(name,checked){element(name).checked=checked;emit(element(name),'change');}
function input(name,value){element(name).value=String(value);emit(element(name),'input');}
function state(){return sandbox.document.body.dataset.state;}
function tick(ms){const end=time+ms;while(time<end){time+=16;for(const [key,t]of [...timers])if(t.at<=time){timers.delete(key);t.fn();}const frames=[...rafs];rafs.clear();for(const [,fn]of frames)fn(time);assert.equal(rafs.size,1,'one visual frame loop throughout');}}
function touch(type,pointerId=1,x=130,y=440,extra={}){emit(type==='pointerdown'?element('animLayer'):sandbox,type,{pointerId,clientX:x,clientY:y,...extra});}
function noRandom(fn){const original=Math.random;Math.random=()=>{throw Error('portal animation and gestures must not draw result randomness');};try{fn();}finally{Math.random=original;}}

assert.equal(state(),'SETTINGS');assert.equal(rafs.size,1);
change('s_master',false);assert.equal(element('btnStart').disabled,true);
click('btnStart');assert.equal(state(),'SETTINGS','invalid settings cannot begin a round');
change('s_muggle',true);input('muggleChance',100);assert.equal(element('btnStart').disabled,false);
click('btnStart');assert.equal(state(),'STANDBY');
const roundResult=pageSession.currentResult;
assert.equal(roundResult.type,'muggle');assert.ok(Object.isFrozen(roundResult));
const startPhase=portal.phase;
noRandom(()=>tick(6000));assert.equal(state(),'STANDBY','idle waits indefinitely for touch');
assert.ok(portal.phase>startPhase,'idle portal rotates');assert.ok(drawCalls>0,'portal draws during page frames');
const idleSpeed=portal.speed;assert.ok(idleSpeed>0);
touch('pointermove',1,300,500);tick(500);assert.equal(portal.pointer.id,null,'hover does not take control');
assert.ok(Math.abs(portal.speed-idleSpeed)<1e-6,'hover does not accelerate');
touch('pointerdown',1,130,440,{pointerType:'mouse',button:2});assert.equal(state(),'STANDBY','right click does not start interaction');
touch('pointerdown');assert.equal(state(),'INTERACTION');
touch('pointerdown',2);touch('pointerup',2);touch('pointermove',2,350,800);
assert.equal(portal.pointer.id,1,'secondary pointer cannot release the active touch');
C.interactionPreview=false; // This phase stays interactive even with the retired preview flag off.
noRandom(()=>{tick(1000);touch('pointermove',1,120,500);tick(59000);});
assert.equal(state(),'INTERACTION','one minute held never starts certification');
assert.ok(portal.speed>idleSpeed*2,'holding visibly accelerates rotation');
const heldSpeed=portal.speed;
touch('pointerup');assert.equal(portal.pointer.id,null);noRandom(()=>tick(160));
assert.ok(portal.speed<heldSpeed,'release begins slowing rotation');
noRandom(()=>tick(60000));assert.equal(state(),'INTERACTION','release never starts core or results');
assert.ok(Math.abs(portal.speed-idleSpeed)<1e-4,'release returns to idle speed');
assert.equal(pageSession.currentResult,roundResult,'touch cannot change the preselected outcome');
assert.equal(element('resultCard').classList.contains('show'),false,'results remain hidden');
assert.equal(timers.size,0,'no automatic result transition is scheduled');

// Cancel, capture loss, blur, rotation and backgrounding release control.
touch('pointerdown',3);touch('pointercancel',3);assert.equal(portal.pointer.id,null);
touch('pointerdown',7);emit(element('animLayer'),'lostpointercapture',{pointerId:7});assert.equal(portal.pointer.id,null);
touch('pointerdown',8);emit(sandbox,'blur');assert.equal(portal.pointer.id,null);
touch('pointerdown',9);sandbox.innerWidth=sandbox.visualViewport.width=844;sandbox.innerHeight=sandbox.visualViewport.height=390;
emit(sandbox,'resize');assert.equal(portal.pointer.id,null);assert.equal(portal.width,844);assert.equal(portal.height,390);tick(100);
sandbox.innerWidth=sandbox.visualViewport.width=390;sandbox.innerHeight=sandbox.visualViewport.height=844;emit(sandbox.visualViewport,'resize');
assert.equal(portal.width,390);assert.equal(portal.height,844);
touch('pointerdown',10);tick(100);sandbox.document.hidden=true;emit(sandbox.document,'visibilitychange');assert.equal(portal.pointer.id,null,'hidden document releases touch');
const pausedTime=portal.time,pausedPhase=portal.phase;
touch('pointerdown',10);assert.equal(portal.pointer.id,null,'hidden page rejects new control');
tick(10000);assert.equal(portal.time,pausedTime);assert.equal(portal.phase,pausedPhase,'hidden animation does not advance');
sandbox.document.hidden=false;emit(sandbox.document,'visibilitychange');tick(16);
assert.ok(portal.time-pausedTime<0.1,'resume cannot jump by the background interval');tick(500);assert.ok(portal.time>pausedTime);
touch('pointerdown',11);emit(sandbox,'pagehide');assert.equal(portal.pointer.id,null);
const pagehideTime=portal.time;tick(10000);assert.equal(portal.time,pagehideTime,'pagehide freezes even before document.hidden changes');
touch('pointerdown',12);assert.equal(portal.pointer.id,null,'pagehide rejects new control');
emit(sandbox,'pageshow');tick(100);assert.ok(portal.time>pagehideTime,'pageshow resumes safely');
assert.equal(pageSession.currentResult,roundResult);
click('btnRetryCert');assert.equal(state(),'STANDBY');assert.notEqual(pageSession.currentResult,roundResult,'retry selects a new round');
assert.equal(portal.pointer.id,null);assert.equal(portal.time,0,'retry resets portal time');assert.equal(element('resultCard').classList.contains('show'),false);
touch('pointerdown',13);tick(100);click('btnGoHome');assert.equal(state(),'SETTINGS');assert.equal(pageSession.currentResult,null);assert.equal(portal.pointer.id,null,'returning to settings releases active control');
const stoppedTime=portal.time;tick(8000);assert.equal(portal.time,stoppedTime,'settings pause the portal');
assert.equal(element('muggleChance').value,'100');assert.equal(timers.size,0);

// Settings still select the stored outcome and preserve light/dark rank rules.
for(const [attr,rank,ticket]of [['火','E',0.999],['水','B',0.4],['風','C',0.6],['土','D',0.8],['光','A',0],['暗','S',0.7],['火','SS',0]]){
  change('s_master',false);change('s_'+({火:'fire',水:'water',風:'wind',土:'earth',光:'light',暗:'dark'}[attr]),true);
  const original=Math.random;Math.random=rng([0,ticket,0.5]);try{click('btnStart');}finally{Math.random=original;}
  assert.equal(pageSession.currentResult.element,attr);assert.equal(pageSession.currentResult.rank,rank);
  noRandom(()=>{touch('pointerdown');tick(100);touch('pointerup');tick(100);});
  assert.equal(state(),'INTERACTION');assert.equal(element('resultCard').classList.contains('show'),false);click('btnGoHome');
}
change('s_master',true);for(const key of ['fire','water','wind','earth','light','dark','muggle'])assert.equal(element('s_'+key).checked,true);
change('s_fire',false);assert.equal(element('s_master').checked,false);
input('chance_E',100);assert.equal(element('percent_E').textContent,'100%');assert.equal(Number(element('chance_SS').value),0);
change('s_master',false);change('s_fire',true);click('btnStart');assert.equal(pageSession.currentResult.rank,'E','slider reaches actual round draw');
click('btnGoHome');assert.equal(Number(element('chance_E').value),100,'rank settings survive returning home');
change('s_muggle',false);assert.equal(element('muggleChance').disabled,true);assert.equal(element('v_muggle').textContent,'關');
const toggledBefore=element('s_fire').checked;click('restoreProbabilities');assert.equal(Number(element('muggleChance').value),8);
for(const [k,v]of Object.entries(C.normalRanks))assert.equal(Number(element('chance_'+k).value),Math.round(v*100));
assert.equal(element('s_muggle').checked,false,'restore does not change switches');assert.equal(element('s_fire').checked,toggledBefore);

const sw=fs.readFileSync('service-worker.js','utf8');
for(const asset of [...sw.matchAll(/"(\.\/[^"\n]+)"/g)].map(x=>x[1]))assert.ok(fs.existsSync(asset),'cached file exists: '+asset);
for(const asset of imports)assert.ok(sw.includes(asset),'page script available offline: '+asset);
JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
delete global.document;
console.log('Page regression checks passed: result boundaries, settings, portal hold/release, pointer ownership, lifecycle and offline assets.');
