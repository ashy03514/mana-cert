const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/effect-settings.js');
require('../js/ribbon-renderer.js');
require('../js/finger-trails.js');
require('../js/probability-settings.js');
require('../js/result-system.js');
require('../js/portal-scene.js');
require('../js/runtime.js');
require('../js/audio.js');
require('../js/element-material-renderer.js');
require('../js/element-reveal-backdrop.js');
require('../js/fire-scan-transition.js');
require('../js/water-rank-effects.js');
require('../js/wind-rank-effects.js');
require('../js/fire-rank-sparkles.js');
require('../js/fire-rank-embers.js');
require('../js/reveal-flow.js');
require('../js/reveal-gather.js');
require('../js/reveal-atmosphere.js');
require('../js/reveal-shockwaves.js');
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
assert.ok(imports.indexOf('./js/ribbon-renderer.js')<imports.indexOf('./js/finger-trails.js'),'shared ribbon renderer loads before pointer adapter');
let time=0,id=0,drawCalls=0,sandbox,portal,pageSession,material,ocean,tornado;
const tornadoInstances=[];
const timers=new Map(),rafs=new Map(),elements=new Map();
function eventTarget(extra={}){const target={handlers:{},...extra};target.addEventListener=(type,fn)=>{(target.handlers[type]??=[]).push(fn);};return target;}
function emit(target,type,event={}){assert.ok(target.handlers[type]?.length,'registered event: '+type);for(const fn of target.handlers[type])fn({type,preventDefault(){},...event});}
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
  return eventTarget({style:{setProperty(name,value){this[name]=value;}},dataset:{},checked:true,value:'',textContent:'',className:'',children:[],
    append(...items){items.forEach(item=>this.appendChild(item));},
    appendChild(item){this.children.push(item);item.parent=this;},
    insertBefore(item,before){this.children.splice(this.children.indexOf(before),0,item);item.parent=this;},
    remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);},
    querySelector(selector){this.parts??=new Map();if(!this.parts.has(selector))this.parts.set(selector,makeElement());return this.parts.get(selector);},
    classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},contains(x){return classes.has(x);},toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);}},
    focus(){},setAttribute(name,value){attrs.set(name,String(value));},getAttribute(name){return attrs.get(name)??null;},getContext(){return context2d;},
    getBoundingClientRect(){return {left:0,top:0,width:sandbox?.visualViewport.width??390,height:sandbox?.visualViewport.height??844};},
    setPointerCapture(pointerId){captured.add(pointerId);},releasePointerCapture(pointerId){captured.delete(pointerId);},hasPointerCapture(pointerId){return captured.has(pointerId);}
  });
}
function element(name){assert.ok(htmlIds.has(name),'actual DOM element exists: '+name);if(!elements.has(name))elements.set(name,makeElement());return elements.get(name);}
class ObservedPortal extends PortalScene {constructor(...args){super(...args);portal=this;}}
class ObservedSession extends R.Session {
  constructor(){super();pageSession=this;this.transitions=[];}
  transition(state){super.transition(state);this.transitions.push(state);}
}
// Real material lifecycle with an isolated drawing stub; the WebGL suite renders all six.
class ObservedMaterial extends ElementMaterialRenderer {
  constructor(){super(()=>makeElement());material=this;}
  init(){return true;}
  compile(){return {};}
  draw(_context,_background,_width,_height,frame=null){this.drawCount=(this.drawCount||0)+1;this.lastFrame=frame;return true;}
}
// The browser suite owns actual ocean GPU/texture coverage. This host stub
// records the separate preview owner and allows deterministic loading tests.
class ObservedOcean {
  constructor(){ocean=this;this.loaded=true;this.lost=false;this.error='';this.disposed=false;}
  draw(_context,_background,_width,_height,frame){this.lastFrame=frame;return this.loaded;}
  dispose(){this.disposed=true;}
}
// Real shader pixels are covered by wind-tornado-browser.cjs. This separate
// owner records shared preview/formal lifecycle without selecting an outcome.
class ObservedTornado {
  constructor(){tornado=this;tornadoInstances.push(this);this.error='';this.lost=false;this.disposed=false;this.drawCount=0;this.time=0;}
  layout(width,height){return {x:width*.08,y:height*.03,width:width*.84,height:height*.48};}
  scanLayout(width,height,_profile,shift){return FireScanTransition.layout(width,height,this.layout(width,height),shift);}
  draw(_context,_background,width,height,frame){
    assert.equal(this.disposed,false,'a disposed wind renderer cannot be reused');
    assert.ok(Number.isFinite(frame.time),'wind receives a finite animation clock');
    this.lastFrame=frame;this.time=frame.time;this.playbackRate=frame.playbackRate;
    this.renderBox=this.layout(width,height);this.drawCount++;return true;
  }
  dispose(){this.disposed=true;}
}
sandbox=eventTarget({ActiveTimeline,AdaptiveQuality,AudioManager,optionalVibrate,EffectSettings,ManaConfig:C,ManaResults:{...R,Session:ObservedSession},PortalScene:ObservedPortal,ProbabilitySettings,ElementMaterialRenderer:ObservedMaterial,WaterOceanReveal:ObservedOcean,WindTornadoRenderer:ObservedTornado,ElementRevealBackdrop,FireScanTransition,WaterRankEffects,WindRankEffects,FireRankSparkles,FireRankEmbers,RevealFlow,RevealGather,RevealAtmosphere,RevealShockwaves,
  console,Math,innerWidth:390,innerHeight:844,devicePixelRatio:3,performance:{now:()=>time},navigator:{},visualViewport:eventTarget({width:390,height:844}),
  document:eventTarget({hidden:false,createElement:()=>makeElement(),getElementById:element,documentElement:makeElement(),body:makeElement(),
    querySelectorAll(selector){assert.equal(selector,'[data-flow-preview]');return [...html.matchAll(/\bdata-flow-preview[ >]/g)].map(()=>makeElement());}}),
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
assert.equal(element('particleCanvas').width,780);
assert.equal(element('particleCanvas').height,1688,'mobile output preserves the reference 2x detail');
click('tab_effects');input('effect_dotCount',180);input('effect_starSize',150);
input('effect_dotDepth',175);input('effect_mistDrift',0);input('effect_starDuration',2.2);
input('effect_backgroundCenter','#102030');input('effect_backgroundOuter','#607080');
input('muggleChance',17);change('s_fire',false);
noRandom(()=>click('effectPreview'));
assert.equal(state(),'EFFECT_PREVIEW');assert.equal(portal.dots.length,180);
assert.equal(portal.settings.dotDepth,175);assert.equal(portal.motion.mistDrift,0);
assert.equal(portal.sparkleConfig.lifeMin,1.6);assert.equal(portal.settings.backgroundCenter,'#102030');
assert.equal(portal.sparkleConfig.sizeMax,60);assert.equal(pageSession.currentResult,null,'preview never draws a certification result');
touch('pointerdown');
touch('pointermove',1,250,500,{getCoalescedEvents:()=>[{clientX:180,clientY:460},{clientX:220,clientY:480}]});
assert.equal(portal.trails.active.points.length,4,'drawing consumes smooth coalesced pointer samples');
noRandom(()=>tick(2500));assert.equal(portal.speed,portal.activeSpeed);
touch('pointerup',1,270,520);
assert.deepEqual(portal.trails.strokes[0].rawTip,{x:270,y:520},'final pointerup endpoint is retained independently of the preview smoothing');
const renderedTip=portal.trails.strokes[0].points.at(-1);
assert.ok(Math.hypot(renderedTip.x-270,renderedTip.y-520)<8,'filtered final endpoint stays close to the release position');
assert.equal(portal.trails.active,null);touch('pointerdown',1,50,100);assert.equal(portal.trails.strokes.length,2);
click('effectPreviewBack');assert.equal(state(),'SETTINGS');assert.equal(portal.pointer.id,null);
assert.equal(portal.trails.strokes.length,0,'return to settings clears drawing history');
assert.equal(element('panel_effects').hidden,false);assert.equal(element('effectPreviewBack').hidden,true);
const originalPortal=portal;
noRandom(()=>click('materialPreviewOpen'));
assert.equal(state(),'ELEMENT_PREVIEW');assert.equal(element('materialControls').hidden,false);
assert.equal(pageSession.currentResult,null,'sample previews never draw a result');
assert.equal(portal.settings.backgroundCenter,EffectSettings.defaults.backgroundCenter,'samples share the approved quiet background');
for(const key of ['fire','water','wind','earth','light','dark']){
  noRandom(()=>click('material_'+key));assert.equal(material.element,key);
  assert.equal(element('material_'+key).getAttribute('aria-pressed'),'true');assert.equal(material.time,0);
  const previousLegacyDraws=material.drawCount;
  noRandom(()=>tick(100));assert.ok(material.time>0);
  if(key==='wind'){
    assert.ok(tornado.drawCount>0,'wind material preview uses the independent SS renderer');
    assert.equal(tornado.playbackRate,1.5,'material preview uses the standalone 1.5x playback setting');
    assert.equal(tornado.time,material.time,'the selected wind speed does not alter the material host clock');
    assert.equal(material.drawCount,previousLegacyDraws,'legacy wind is not drawn underneath the SS preview');
    assert.equal(element('fireScanReadout').hidden,true,'SS wind study has no fabricated rank or mana');
    assert.equal(element('materialWindRanks').hidden,false,'wind preview exposes its own rank controls');
    for(const profile of WindRankEffects.profiles){
      noRandom(()=>click('windRank_'+profile.rank));
      assert.equal(tornado.lastFrame.rank,profile.rank,'rank selector reaches the wind renderer');
      assert.equal(element('windRank_'+profile.rank).getAttribute('aria-pressed'),'true');
      assert.equal(material.time,0,'a selected rank restarts its own material sample');
      assert.equal(pageSession.currentResult,null,'choosing a visual rank never draws a certification');
    }
    assert.equal(element('muggleChance').value,'17','visual ranks do not change probability settings');
    assert.equal(element('s_fire').checked,false,'visual ranks do not change element settings');
  }
  else assert.equal(element('materialWindRanks').hidden,true,'wind rank controls stay out of other elements');
}
touch('pointerdown',20);touch('pointermove',20,200,200);touch('pointerup',20);
assert.equal(portal.pointer.id,null);assert.equal(originalPortal.trails.strokes.length,0,'material samples cannot draw finger trails');
click('materialPause');const materialTime=material.time,backdropTime=portal.time;
tick(1000);assert.equal(material.time,materialTime);assert.equal(portal.time,backdropTime,'pause freezes the full sample');
click('materialReplay');assert.equal(material.time,0);assert.equal(material.paused,false);
tick(200);sandbox.document.hidden=true;emit(sandbox.document,'visibilitychange');
const hiddenMaterialTime=material.time;tick(1000);assert.equal(material.time,hiddenMaterialTime,'backgrounding pauses materials');
sandbox.document.hidden=false;emit(sandbox.document,'visibilitychange');tick(16);assert.ok(material.time-hiddenMaterialTime<.1);
click('effectPreviewBack');assert.equal(state(),'SETTINGS');assert.equal(element('materialControls').hidden,true);
assert.equal(tornado.disposed,true,'returning from the material preview releases the tornado renderer');
const closedMaterialTime=material.time;tick(200);assert.equal(material.time,closedMaterialTime);
assert.equal(element('muggleChance').value,'17');assert.equal(element('s_fire').checked,false,'sample selection never edits outcome settings');
portal=originalPortal;
// The interactive reveal is a separate preview; input may never select an outcome.
noRandom(()=>click('flowPreviewOpen'));
assert.equal(state(),'FLOW_PREVIEW');assert.equal(element('materialReplay').textContent,'重新畫一次');
const flowPortal=portal;
touch('pointerdown',31,100,250);touch('pointerup',31,100,250);
noRandom(()=>tick(1600));assert.equal(element('materialStatus').textContent,'畫完後放開','a tap has no reveal');
touch('pointerdown',32,100,250);touch('pointermove',32,230,400);
noRandom(()=>tick(7000));assert.equal(element('materialStatus').textContent,'畫完後放開','holding never starts the reveal');
touch('pointerup',32,230,400);
const releaseFlowTime=flowPortal.trails.time,releaseAgeTime=flowPortal.trails.ageTime;
const releaseOpacity=flowPortal.trails.opacity(flowPortal.trails.strokes.at(-1));
tick(700);
assert.ok(flowPortal.trails.time>releaseFlowTime+.6,'release waiting advances the live ribbon animation clock');
assert.ok(Math.abs(flowPortal.trails.ageTime-releaseAgeTime)<1e-9,'waiting keeps ink life without freezing its animation');
assert.equal(flowPortal.trails.opacity(flowPortal.trails.strokes.at(-1)),releaseOpacity);
assert.equal(element('materialStatus').textContent,'可接著畫');
touch('pointerdown',33,230,400);touch('pointermove',33,190,460);tick(800);
assert.equal(element('materialStatus').textContent,'畫完後放開','continuing cancels the pending reveal');
touch('pointerup',33,190,460);tick(1250);
assert.equal(element('materialStatus').textContent,'魔力蓄勢','the completed inward waves are followed by a charge hold');
tick(400);assert.equal(element('materialStatus').textContent,'魔力蓄勢','the burst cannot start before the half-second hold finishes');
tick(100);
assert.equal(element('materialStatus').textContent,'魔力收束');
const snapshot=JSON.stringify(flowPortal.trails.strokes.map(s=>s.points));
touch('pointerdown',34,80,280);touch('pointermove',34,340,550);touch('pointerup',34);
assert.equal(JSON.stringify(flowPortal.trails.strokes.map(s=>s.points)),snapshot,'input is locked once gathering starts');
click('materialPause');tick(2000);assert.equal(element('materialStatus').textContent,'已暫停');
click('materialPause');tick(900);
assert.equal(element('materialStatus').textContent,'魔力收束','the expanded cloud is still in its slow outward phase');
tick(600);
assert.equal(element('materialStatus').textContent,'魔力收束','the return remains active after the previous 1.5-second gather duration');
tick(600);assert.equal(element('materialStatus').textContent,'屬性形成');
sandbox.document.hidden=true;emit(sandbox.document,'visibilitychange');const pausedFlowTime=flowPortal.time;
tick(9000);assert.equal(flowPortal.time,pausedFlowTime);
sandbox.document.hidden=false;emit(sandbox.document,'visibilitychange');tick(16);
assert.equal(element('materialStatus').textContent,'屬性形成','hidden interval cannot skip phases');
noRandom(()=>tick(3900)); // Fire now grows for 1.2 s (other materials retain 0.8 s).
assert.equal(element('materialStatus').textContent,'魔力攀升');assert.equal(element('revealTitle').textContent,'火屬性');
assert.equal(element('fireScanReadout').hidden,false,'fire preview exposes the measurement after formation');
assert.equal(element('fireScanLabel').textContent,'預覽數值','the preview visibly distinguishes its sample value');
const partialPreviewValue=Number(element('fireScanValue').textContent);
assert.ok(partialPreviewValue>=0&&partialPreviewValue<862,'the sample counts toward its fixed preview endpoint');
assert.equal(material.lastFrame.firePower,FireScanTransition.powerForValue(partialPreviewValue),'preview fire follows the number currently displayed, not its final target');
click('materialPause');const pausedPreviewValue=element('fireScanValue').textContent;
const pausedPreviewFire={power:material.lastFrame.firePower,time:material.lastFrame.fireTime};
noRandom(()=>tick(3000));assert.equal(element('fireScanValue').textContent,pausedPreviewValue,'preview pause freezes the counter');
assert.deepEqual({power:material.lastFrame.firePower,time:material.lastFrame.fireTime},pausedPreviewFire,'preview pause freezes both the fire power and its continuous burning clock');
click('materialPause');
sandbox.document.hidden=true;emit(sandbox.document,'visibilitychange');
noRandom(()=>tick(3000));assert.equal(element('fireScanValue').textContent,pausedPreviewValue,'backgrounding cannot advance the counter');
sandbox.document.hidden=false;emit(sandbox.document,'visibilitychange');tick(16);
assert.equal(element('fireScanValue').textContent,pausedPreviewValue,'resume does not jump the counter by the hidden interval');
noRandom(()=>tick(4000));assert.equal(element('materialStatus').textContent,'階段完成');
assert.equal(Number(element('fireScanValue').textContent),862);assert.equal(element('fireScanRank').textContent,'A');
assert.equal(material.lastFrame.firePower,FireScanTransition.powerForValue(862),'preview holds the flame strength for its visible A value');
assert.equal(pageSession.currentResult,null,'a complete flow preview does not draw a certification result');
assert.equal(element('resultCard').classList.contains('show'),false,'preview never displays a fabricated result');
click('materialReplay');assert.equal(flowPortal.trails.strokes.length,0);assert.equal(element('revealTitle').hidden,true);
assert.equal(element('fireScanReadout').hidden,true,'replay clears the previous measurement');
click('material_water');
const legacyBeforeOcean=material.drawCount;
ocean.loaded=false;
noRandom(()=>{touch('pointerdown',71,110,310);touch('pointermove',71,260,410);touch('pointerup',71,260,410);tick(3000);});
assert.equal(element('materialStatus').textContent,'可接著畫','loading ocean detail cannot consume the reveal timeline');
assert.equal(element('materialError').textContent,'正在載入海面材質…');
ocean.loaded=true;noRandom(()=>tick(9500));
assert.equal(element('materialStatus').textContent,'階段完成','water preview holds its measurement endpoint');
assert.equal(element('fireScanLabel').textContent,'預覽數值');
assert.equal(Number(element('fireScanValue').textContent),9999);
assert.equal(element('fireScanRank').textContent,'SS');
assert.equal(ocean.lastFrame.waterPower,3,'the new ocean preview reaches its own SS volume');
assert.equal(material.drawCount,legacyBeforeOcean,'the old water material is not drawn beneath the ocean');
assert.equal(pageSession.currentResult,null,'water preview never creates a formal result');
click('materialPause');const pausedWaterTime=ocean.lastFrame.time;
noRandom(()=>tick(1000));assert.equal(ocean.lastFrame.time,pausedWaterTime,'water preview pauses its internal currents');
click('material_wind');
const legacyBeforeTornado=material.drawCount;
assert.equal(tornadoInstances.length,2,'flow preview constructs a fresh tornado after the prior owner was disposed');
noRandom(()=>click('windRank_B'));
assert.equal(element('materialStatus').textContent,'畫完後放開','selecting a flow rank waits for a fresh drawing');
noRandom(()=>{touch('pointerdown',73,110,310);touch('pointermove',73,260,410);touch('pointerup',73,260,410);tick(9500);});
assert.equal(tornado.lastFrame.rank,'B','draw-to-reveal uses the selected rank');
assert.equal(pageSession.currentResult,null,'draw-to-reveal rank selection has no outcome');
noRandom(()=>click('windRank_SS'));
assert.equal(flowPortal.trails.strokes.length,0,'changing the flow rank clears the previous drawing');
assert.equal(element('materialStatus').textContent,'畫完後放開');
noRandom(()=>{touch('pointerdown',72,110,310);touch('pointermove',72,260,410);touch('pointerup',72,260,410);tick(9500);});
assert.ok(tornado.drawCount>0,'draw-to-reveal wind reaches the SS prototype');
assert.equal(tornado.playbackRate,1.5,'draw-to-reveal shares the approved standalone 1.5x playback setting');
assert.equal(material.drawCount,legacyBeforeTornado,'the SS flow preview does not draw legacy wind');
assert.equal(element('fireScanReadout').hidden,true,'wind preview holds at reveal without showing rank or mana');
assert.equal(pageSession.currentResult,null,'wind preview never creates a formal result');
const liveTornadoTime=tornado.time;
noRandom(()=>tick(5000));assert.ok(tornado.time>liveTornadoTime+4,'wind remains animated at the reveal endpoint');
assert.ok(Math.abs(tornado.time-liveTornadoTime-5)<.1,'wind playback speed does not accelerate the reveal stage clock');
click('materialPause');const pausedTornadoTime=tornado.time;
noRandom(()=>tick(1000));assert.equal(tornado.time,pausedTornadoTime,'pause freezes the SS wind animation');
click('materialPause');
emit(sandbox,'pagehide');noRandom(()=>tick(2000));assert.equal(tornado.time,pausedTornadoTime,'pagehide freezes the SS wind clock');
emit(sandbox,'pageshow');tick(16);assert.ok(tornado.time-pausedTornadoTime<.1,'wind resumes without a hidden-time jump');
click('materialReplay');assert.equal(flowPortal.trails.strokes.length,0,'wind replay clears the previous drawing');
assert.equal(element('materialStatus').textContent,'畫完後放開');
const windDrawCountBeforeSwitch=tornado.drawCount;
click('material_fire');noRandom(()=>tick(100));
assert.equal(tornado.drawCount,windDrawCountBeforeSwitch,'switching to fire does not redraw the wind effect');
click('material_water');noRandom(()=>tick(100));
assert.equal(tornado.drawCount,windDrawCountBeforeSwitch,'switching to water does not redraw the wind effect');
for(const key of ['water','wind','earth','light','dark','fire']){
  click('material_'+key);assert.equal(material.element,key);assert.equal(flowPortal.trails.strokes.length,0);
  assert.equal(element('fireScanReadout').hidden,true,'changing the preview attribute clears the fire measurement');
}
touch('pointerdown',35,110,310);touch('pointermove',35,210,410);touch('pointerup',35,210,410);tick(400);
emit(sandbox,'blur');tick(2000);assert.equal(element('materialStatus').textContent,'畫完後放開','blur cancels the waiting countdown');
click('effectPreviewBack');assert.equal(state(),'SETTINGS');assert.equal(element('revealTitle').hidden,true);
assert.equal(ocean.disposed,true,'leaving the preview releases the ocean resources');
assert.equal(tornado.disposed,true,'leaving the flow preview releases the tornado resources');
assert.equal(element('materialControls').hidden,true);
const stoppedFlowTime=flowPortal.time;tick(2000);assert.equal(flowPortal.time,stoppedFlowTime);
assert.equal(element('muggleChance').value,'17');assert.equal(element('s_fire').checked,false);
portal=originalPortal;
click('effect_reset_background');assert.equal(element('effect_backgroundCenter').value,'#080915');
assert.equal(Number(element('effect_dotDepth').value),175,'background reset leaves particle tuning unchanged');
click('effect_reset_stars');assert.equal(Number(element('effect_starSize').value),100);
assert.equal(Number(element('effect_starDuration').value),1.1);
assert.equal(Number(element('effect_dotCount').value),180);
click('effectResetAll');assert.equal(Number(element('effect_dotCount').value),55);
assert.equal(element('effect_starEnabled').checked,false,'approved reference keeps the large ambient stars disabled by default');
assert.equal(element('muggleChance').value,'17');assert.equal(element('s_fire').checked,false,'effect reset cannot alter result switches');
change('s_master',true);click('restoreProbabilities');click('tab_switches');
assert.equal(element('panel_switches').hidden,false);
assert.equal(element('panel_probabilities').hidden,true);
click('tab_probabilities');
input('muggleChance',17);
assert.equal(element('panel_switches').hidden,true);
assert.equal(element('panel_probabilities').hidden,false);
click('tab_effects');
assert.equal(element('panel_probabilities').hidden,true);
assert.equal(element('panel_effects').hidden,false);
assert.equal(element('tab_effects').getAttribute('aria-selected'),'true');
click('tab_probabilities');
assert.equal(element('muggleChance').value,'17','tab switching preserves edited probabilities');
click('restoreProbabilities');click('tab_switches');
assert.equal(element('panel_effects').hidden,true);
change('s_master',false);assert.equal(element('btnStart').disabled,true);
click('btnStart');assert.equal(state(),'SETTINGS','invalid settings cannot begin a round');
change('s_muggle',true);input('muggleChance',100);assert.equal(element('btnStart').disabled,false);
const materialDrawsBeforeMuggle=material.drawCount||0;
click('btnStart');assert.equal(state(),'STANDBY');
const roundResult=pageSession.currentResult;
assert.equal(roundResult.type,'muggle');assert.ok(Object.isFrozen(roundResult));
assert.equal(element('formalReplay').hidden,true,'formal replay is hidden before the reveal');
const startPhase=portal.phase;
noRandom(()=>tick(6000));assert.equal(state(),'STANDBY','idle waits indefinitely for touch');
assert.ok(portal.phase>startPhase,'idle portal rotates');assert.ok(drawCalls>0,'portal draws during page frames');
const idleSpeed=portal.speed;assert.ok(idleSpeed>0);
touch('pointermove',1,300,500);tick(500);assert.equal(portal.pointer.id,null,'hover does not take control');
assert.ok(Math.abs(portal.speed-idleSpeed)<1e-6,'hover does not accelerate');
touch('pointerdown',1,130,440,{pointerType:'mouse',button:2});assert.equal(state(),'STANDBY','right click does not start interaction');
touch('pointerdown',50,130,440);touch('pointerup',50,130,440);noRandom(()=>tick(2000));
assert.equal(state(),'INTERACTION','a stationary tap cannot start the formal reveal');
touch('pointerdown');assert.equal(state(),'INTERACTION');
touch('pointerdown',2);touch('pointerup',2);touch('pointermove',2,350,800);
assert.equal(portal.pointer.id,1,'secondary pointer cannot release the active touch');
C.interactionPreview=false; // The retired preview flag cannot interrupt held input.
noRandom(()=>{tick(1000);touch('pointermove',1,120,500);tick(59000);});
assert.equal(state(),'INTERACTION','one minute held never starts certification');
assert.ok(portal.speed>idleSpeed*2,'holding visibly accelerates rotation');
const heldSpeed=portal.speed;
const formalReleaseTime=portal.trails.time,formalReleaseAge=portal.trails.ageTime;
touch('pointerup');assert.equal(portal.pointer.id,null);noRandom(()=>tick(160));
assert.ok(portal.speed<heldSpeed,'release begins slowing rotation');
assert.ok(portal.trails.time>formalReleaseTime,'formal release waiting keeps the ribbon animation moving');
assert.ok(Math.abs(portal.trails.ageTime-formalReleaseAge)<1e-9,'formal release retains ink age without freezing animation');
noRandom(()=>tick(1100));assert.equal(state(),'INTERACTION','formal input remains resumable after the inward waves finish');
noRandom(()=>tick(400));assert.equal(state(),'INTERACTION','formal burst waits through the half-second charge hold');
noRandom(()=>tick(100));assert.equal(state(),'GATHER','a meaningful released drawing enters the shared gather sequence after the hold');
assert.equal(pageSession.currentResult,roundResult,'touch cannot change the preselected outcome');
noRandom(()=>tick(6000));assert.equal(state(),'ELEMENT_REVEAL','formal flow stops at the attribute reveal');
assert.equal(element('revealTitle').textContent,'未顯現屬性','muggle does not receive a fabricated element');
assert.equal(element('revealTitle').hidden,false);assert.equal(element('formalReplay').hidden,false);
assert.equal(element('materialControls').hidden,true,'formal flow hides the prototype element and pause controls');
assert.equal(material.drawCount||0,materialDrawsBeforeMuggle,'muggle never draws a material shader');
noRandom(()=>tick(60000));assert.equal(state(),'ELEMENT_REVEAL','formal endpoint remains visible indefinitely');
assert.equal(pageSession.currentResult,roundResult,'the revealed round remains immutable');
assert.equal(element('resultCard').classList.contains('show'),false,'results remain hidden');
assert.equal(timers.size,0,'no automatic result transition is scheduled');

click('formalReplay');assert.equal(state(),'STANDBY');
const lifecycleResult=pageSession.currentResult;
assert.notEqual(lifecycleResult,roundResult,'formal replay begins a fresh round');
assert.equal(element('revealTitle').hidden,true);assert.equal(element('formalReplay').hidden,true);
// Cancel, capture loss, blur, rotation and backgrounding release control.
touch('pointerdown',3);touch('pointercancel',3);assert.equal(portal.pointer.id,null);assert.equal(portal.trails.active,null);
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
assert.equal(pageSession.currentResult,lifecycleResult);
click('btnRetryCert');assert.equal(state(),'STANDBY');assert.notEqual(pageSession.currentResult,lifecycleResult,'retry selects a new round');
assert.equal(portal.pointer.id,null);assert.equal(portal.time,0,'retry resets portal time');assert.equal(element('resultCard').classList.contains('show'),false);
touch('pointerdown',13);tick(100);click('btnGoHome');assert.equal(state(),'SETTINGS');assert.equal(pageSession.currentResult,null);assert.equal(portal.pointer.id,null,'returning to settings releases active control');
const stoppedTime=portal.time;tick(8000);assert.equal(portal.time,stoppedTime,'settings pause the portal');
assert.equal(element('muggleChance').value,'100');assert.equal(timers.size,0);

// Settings still select the stored outcome and preserve light/dark rank rules.
for(const [attr,rank,ticket]of [['火','E',0.999],['水','B',0.4],['風','E',0.999],['風','D',0.8],['風','C',0.6],['風','B',0.4],['風','A',0.2],['風','S',0.08],['風','SS',0],['土','D',0.8],['光','A',0],['暗','S',0.7],['火','SS',0],['水','SS',0]]){
  const previewTornadoCount=tornadoInstances.length;
  change('s_master',false);change('s_'+({火:'fire',水:'water',風:'wind',土:'earth',光:'light',暗:'dark'}[attr]),true);
  const original=Math.random;Math.random=rng([0,ticket,0.5]);try{click('btnStart');}finally{Math.random=original;}
  assert.equal(pageSession.currentResult.element,attr);assert.equal(pageSession.currentResult.rank,rank);
  const immutableResult=pageSession.currentResult,active=attr==='水'?ocean:attr==='風'?tornado:material;
  const measured=attr==='火'||attr==='水'||attr==='風';
  const clockKey=attr==='火'?'fireTime':'time';
  const legacyDrawCount=material.drawCount;
  const scanCount=pageSession.transitions.filter(s=>s==='MANA_SCAN').length;
  noRandom(()=>{
    touch('pointerdown',60,100,250);touch('pointermove',60,250,420);tick(100);touch('pointerup',60,250,420);
    if(attr==='水'){
      ocean.loaded=false;tick(2200);
      assert.equal(state(),'INTERACTION','formal water loading holds the completed stroke before gather');
      assert.equal(pageSession.currentResult,immutableResult,'loading cannot choose another outcome');
      ocean.loaded=true;
    }
    tick(5000);
  });
  if((attr==='火'||attr==='水')){
    assert.equal(active.lastFrame[attr==='水'?'waterPower':'firePower'],0,'formal fire remains a small seed before any mana is shown, including an SS result');
    assert.ok(Number.isFinite(active.lastFrame[attr==='水'?'time':'fireTime']),'formal fire uses a finite continuous shader clock');
  }
  noRandom(()=>tick(2500));
  assert.equal(state(),measured?'MANA_SCAN':'ELEMENT_REVEAL');
  assert.equal(material.element,({火:'fire',水:'water',風:'wind',土:'earth',光:'light',暗:'dark'}[attr]),'formal shader matches the selected attribute');
  assert.equal(element('revealTitle').textContent,attr+'屬性');assert.equal(element('revealTitle').hidden,false);
  assert.equal(element('materialControls').hidden,true);assert.equal(element('formalReplay').hidden,measured);
  assert.equal(element('fireScanReadout').hidden,!measured,'fire, water and wind receive the measurement stage');
  if(measured){
    assert.notEqual(element('fireScanLabel').textContent,'預覽數值','a formal reading is not labelled as a sample');
    assert.ok(Number(element('fireScanValue').textContent)<immutableResult.mana,'formal count starts below its frozen endpoint');
    if(attr==='風')assert.equal(active.lastFrame.windEffects.value,Number(element('fireScanValue').textContent),'wind profile follows the actual displayed mana');
    else assert.equal(active.lastFrame[attr==='水'?'waterPower':'firePower'],FireScanTransition.powerForValue(Number(element('fireScanValue').textContent)),'formal fire follows its actual displayed mana');
    const reading=element('fireScanValue').textContent;
    const burningTime=active.lastFrame[clockKey];
    emit(sandbox,'pagehide');noRandom(()=>tick(10000));
    assert.equal(element('fireScanValue').textContent,reading,'pagehide freezes the formal reading');
    assert.equal(active.lastFrame[clockKey],burningTime,'pagehide also freezes the material simulation clock');
    emit(sandbox,'pageshow');tick(16);
    assert.equal(element('fireScanValue').textContent,reading,'pageshow resumes without jumping');
  }
  const liveMaterialTime=active.lastFrame.time;
  noRandom(()=>tick(10000));assert.equal(state(),measured?'MANA_SCAN':'ELEMENT_REVEAL','measured elements hold at their reading; the others retain their reveal endpoint');
  assert.equal(element('formalReplay').hidden,false);
  assert.equal(pageSession.transitions.filter(s=>s==='MANA_SCAN').length,scanCount+(measured?1:0),'each measured element enters the scan state exactly once');
  assert.ok(!pageSession.transitions.some(s=>s==='RANK_CONFIRM'||s==='RESULT'),'this stage cannot enter confirmation or the final card');
  if(measured){
    assert.equal(Number(element('fireScanValue').textContent),immutableResult.mana,'the formal count uses the original result instead of the preview sample');
    assert.equal(element('fireScanRank').textContent,rank,'the displayed rank follows the reached value, including SS');
    if(attr==='風')assert.equal(active.lastFrame.windEffects.profile.rank,rank,'formal wind holds its reached rank instead of the preview selection');
    else assert.equal(active.lastFrame[attr==='水'?'waterPower':'firePower'],FireScanTransition.powerForValue(immutableResult.mana),'each reached result holds its own mana power rather than every rank reaching maximum');
    if(attr==='水'){
      assert.equal(active.lastFrame.waterEffects.profile.rank,rank,'formal ocean holds the reached rank profile');
      assert.equal(material.drawCount,legacyDrawCount,'formal ocean never draws the old water material');
    }
  }
  assert.ok(active.lastFrame.time>liveMaterialTime+9,'formal material keeps animating at its endpoint');
  assert.equal(tornadoInstances.length,previewTornadoCount+(attr==='風'?1:0),'only formal wind constructs the shared wind renderer');
  if(attr==='風')assert.equal(material.drawCount,legacyDrawCount,'formal wind never draws the retired material');
  assert.equal(pageSession.currentResult,immutableResult,'formal reveal never redraws its result');
  assert.equal(element('resultCard').classList.contains('show'),false);
  click('effectPreviewBack');assert.equal(state(),'SETTINGS');assert.equal(element('panel_switches').hidden,false);
  if(attr==='風')assert.equal(active.disposed,true,'leaving a formal wind round disposes its renderer');
  assert.equal(pageSession.currentResult,null);assert.equal(element('revealTitle').hidden,true);
  assert.equal(element('fireScanReadout').hidden,true,'returning to settings clears the measurement');
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

// Turning ink off does not remove the formal gesture or trap the round in drawing.
change('s_master',false);change('s_water',true);change('effect_trailEnabled',false);
click('btnStart');const noInkResult=pageSession.currentResult;
assert.equal(portal.settings.trailEnabled,false,'formal mode honors the saved ink switch');
noRandom(()=>{touch('pointerdown',70,90,240);touch('pointermove',70,200,360);tick(100);touch('pointerup',70,200,360);tick(5800);});
assert.equal(state(),'ELEMENT_REVEAL','a valid gesture still reaches the material with ink disabled');
assert.equal(portal.trails.strokes.length,0);assert.equal(material.element,'water');
assert.equal(pageSession.currentResult,noInkResult);click('effectPreviewBack');change('effect_trailEnabled',true);

const sw=fs.readFileSync('service-worker.js','utf8');
for(const asset of [...sw.matchAll(/"(\.\/[^"\n]+)"/g)].map(x=>x[1]))assert.ok(fs.existsSync(asset),'cached file exists: '+asset);
for(const asset of imports)assert.ok(sw.includes(asset),'page script available offline: '+asset);
JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
delete global.document;
console.log('Page regression checks passed: immutable fire/water/wind measurements, seven formal wind ranks, shared renderers, loading hold, labelled preview, other attribute endpoints, settings, lifecycle and offline assets.');
