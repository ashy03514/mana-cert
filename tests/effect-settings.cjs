const assert=require('node:assert/strict');
require('../js/effect-settings.js');require('../js/config.js');require('../js/ribbon-renderer.js');require('../js/finger-trails.js');require('../js/portal-scene.js');
const E=EffectSettings;
const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
const chosen={...E.defaults,dotCount:180,starSize:150,mistPalette:['#123456'],starPalette:['#ce83ff','#ffffff']};
assert.ok(E.save(storage,chosen));assert.deepEqual(E.load(storage),chosen);
assert.equal(E.save({setItem(){throw Error('quota');}},chosen),false);
assert.deepEqual(E.load({getItem(){throw Error('denied');}}),E.defaults);
assert.deepEqual(E.load({getItem:()=>'{broken'}),E.defaults);
assert.deepEqual(E.load({getItem:()=>JSON.stringify({version:99,values:chosen})}),E.defaults);
// Saving a personal default is separate from auto-saving the current controls.
const presetData=new Map(),presetStorage={getItem:k=>presetData.get(k),setItem:(k,v)=>presetData.set(k,v)};
assert.deepEqual(E.loadDefaults(presetStorage),E.defaults,'no personal default uses the built-in preset');
function settingsUI(){
  const nodes=new Map();let current;
  function node(){return {listeners:{},children:[],addEventListener(type,fn){this.listeners[type]=fn;},
    setAttribute(){},focus(){},append(...items){items.forEach(item=>this.appendChild(item));},
    appendChild(item){this.children.push(item);item.parent=this;},
    insertBefore(item,before){this.children.splice(this.children.indexOf(before),0,item);item.parent=this;},
    remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);},
    querySelector(selector){this.parts??=new Map();if(!this.parts.has(selector))this.parts.set(selector,node());return this.parts.get(selector);}
  };}
  const doc={createElement:node,getElementById(id){
    if(!nodes.has(id))nodes.set(id,node());
    return nodes.get(id);
  }};
  E.mount(doc,presetStorage,v=>{current=v;});
  return {node:id=>doc.getElementById(id),current:()=>current,
    click:id=>doc.getElementById(id).listeners.click(),
    input:(key,value)=>{const n=doc.getElementById('effect_'+key);n.value=String(value);n.listeners.input();}};
}
const ui=settingsUI();
ui.input('dotCount',115);ui.input('trailWidth',4);ui.click('effectSetDefault');
assert.equal(ui.node('effectSetDefault').textContent,'已設為預設');
assert.equal(E.loadDefaults(presetStorage).dotCount,115);
ui.input('dotCount',200);ui.input('trailWidth',6);
assert.equal(E.loadDefaults(presetStorage).dotCount,115,'ordinary edits cannot overwrite the saved default');
ui.click('effect_reset_dots');
assert.equal(ui.current().dotCount,115);assert.equal(ui.current().trailWidth,6,'group reset preserves other current controls');
const reopened=settingsUI();reopened.click('effectResetAll');
assert.equal(reopened.current().dotCount,115);assert.equal(reopened.current().trailWidth,4,'personal preset survives remount');
reopened.input('dotCount',120);reopened.click('effectSetDefault');
assert.equal(E.loadDefaults(presetStorage).dotCount,120,'explicitly setting defaults replaces the prior preset');
const originalSet=presetStorage.setItem;
presetStorage.setItem=()=>{throw Error('quota');};
reopened.input('dotCount',125);reopened.click('effectSetDefault');
assert.equal(reopened.node('effectSetDefault').textContent,'儲存失敗');
assert.equal(E.loadDefaults(presetStorage).dotCount,120,'failed save retains the prior preset');
presetStorage.setItem=originalSet;
assert.deepEqual(E.loadDefaults({getItem:()=>'{broken'}),E.defaults);
assert.deepEqual(E.loadDefaults({getItem(){throw Error('denied');}}),E.defaults);
assert.equal(E.defaults.dotCount,55,'personal presets cannot mutate factory defaults');
const safe=E.normalize({dotCount:Infinity,mistCount:1e9,dotSize:-9,starSize:'500',dotColor:'red;bad',starBlue:false,starPurple:false,starWhite:false});
assert.equal(safe.dotCount,55);assert.equal(safe.mistCount,144);assert.equal(safe.dotSize,50);
assert.equal(safe.starSize,100);assert.deepEqual(safe.dotPalette,E.defaults.dotPalette);assert.deepEqual(safe.starPalette,['#ffffff']);
const reset=E.resetGroup(chosen,'stars');assert.equal(reset.starSize,100);assert.equal(reset.dotCount,180);assert.deepEqual(reset.mistPalette,['#123456']);
const context=new Proxy({createRadialGradient:()=>({stops:[],addColorStop(at,color){this.stops.push([at,color]);}})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{
  if(k==='globalAlpha')assert.ok(v>=0&&v<=1&&Number.isFinite(v));o[k]=v;return true;
}});
const make=values=>new PortalScene(context,390,844,()=>({getContext:()=>context}),values);
const base=make(E.defaults),changed=make({...chosen,dotSize:200,dotSpeed:150,idleSeconds:20,activeSeconds:.5,acceleration:.5,deceleration:.5});
assert.equal(changed.dots.length,180);assert.equal(changed.dots[0].size,base.dots[0].size*2);
assert.ok(Math.abs(changed.dots[0].rate-base.dots[0].rate*1.5)<1e-12);assert.equal(changed.sparkleConfig.sizeMax,60);
assert.equal(changed.sparkleSprites.length,2);assert.equal(changed.idleSpeed,Math.PI*2/20);
changed.down(1);for(let i=0;i<31;i++)changed.step(1/60);
assert.equal(changed.speed,Math.PI*4);changed.release();for(let i=0;i<31;i++)changed.step(1/60);
assert.equal(changed.speed,changed.idleSpeed);
const off=make({mistEnabled:false,dotEnabled:false,starEnabled:false});
assert.equal(off.mists.length+off.dots.length+off.sparkles.length,0);off.step(.05);off.draw();
const intense=make({starEnabled:true,mistCount:144,dotCount:306,mistOpacity:150,dotOpacity:150,starOpacity:115,starIdle:200,starHeld:200,starSize:200});
assert.equal(intense.sparkles.length,10);assert.equal(intense.sparkleConfig.activeInterval,base.sparkleConfig.activeInterval/2);
intense.down(0);for(let i=0;i<600;i++){intense.step(1/60);intense.draw();}
assert.equal(base.dots.length,55,'customization leaves baseline and shared config unchanged');
assert.equal(ManaConfig.portalSparkles.sizeMax,40);
// A one-time appearance migration replaces old visual overrides, preserves motion,
// and stores an untouched backup. Future customizations survive subsequent loads.
const legacy={...chosen};
for(const k of ['dotDepth','mistDrift','starDuration','backgroundCenter','backgroundOuter'])delete legacy[k];
legacy.idleSeconds=40;legacy.acceleration=3;
const legacyRaw=JSON.stringify({version:1,values:legacy});
const legacyData=new Map([['mana.portal.effects.v1',legacyRaw]]);
const legacyStorage={getItem:k=>legacyData.get(k),setItem:(k,v)=>legacyData.set(k,v)};
const upgraded=E.load(legacyStorage);
assert.equal(upgraded.dotCount,55);assert.equal(upgraded.starSize,100);assert.equal(upgraded.dotDepth,100);assert.equal(upgraded.starDuration,1.1);
assert.equal(upgraded.idleSeconds,40);assert.equal(upgraded.acceleration,3);
assert.equal(legacyData.get('mana.portal.effects.v1.before-reference'),legacyRaw);
assert.deepEqual(E.load(legacyStorage),upgraded,'migration is stable on the next load');
const recustomized={...upgraded,trailPalette:['#abcdef'],backgroundOuter:'#354567'};
assert.ok(E.save(legacyStorage,recustomized));assert.deepEqual(E.load(legacyStorage),recustomized,'new choices persist after migration');
assert.equal(legacyData.get('mana.portal.effects.v1.before-reference'),legacyRaw,'original backup is never overwritten');
assert.deepEqual(E.load({getItem:()=>legacyRaw,setItem(){throw Error('denied');}}),upgraded,'read-only storage still renders approved defaults');
const advanced={...chosen,dotDepth:175,mistDrift:40,starDuration:2.2,backgroundCenter:'#102030',backgroundOuter:'#607080'};
E.save(storage,advanced);assert.deepEqual(E.load(storage),advanced);
const backgroundReset=E.resetGroup(advanced,'background');
assert.equal(backgroundReset.backgroundCenter,E.defaults.backgroundCenter);assert.equal(backgroundReset.dotDepth,175);
const weak=make({dotDepth:0}),deep=make({dotDepth:200});
const spread=(scene,key)=>Math.max(...scene.dots.map(q=>q[key]))-Math.min(...scene.dots.map(q=>q[key]));
for(const key of ['rate','size','alpha']){
  assert.ok(spread(weak,key)<spread(base,key)*.3,'weak depth retains only small individual variations: '+key);
  assert.ok(spread(deep,key)>spread(base,key),'strong depth increases near/far contrast: '+key);
}
assert.equal(new Set(weak.dots.map(q=>q.rate)).size,55,'zero depth still keeps individual speeds');
const still=make({mistDrift:0}),drifting=make({mistDrift:200});
const radii=still.mists.map(q=>[q.radius,q.orbitScale]),driftRadii=drifting.mists.map(q=>q.radius);
const firstAngle=still.mists[0].angle;
for(let i=0;i<600;i++){still.step(1/60);drifting.step(1/60);}
assert.notEqual(still.mists[0].angle,firstAngle,'zero drift still rotates');
assert.deepEqual(still.mists.map(q=>[q.radius,q.orbitScale]),radii,'zero drift keeps fixed orbital bands');
assert.ok(drifting.mists.some((q,i)=>Math.abs(q.radius-driftRadii[i])>2),'high drift visibly moves across the band');
const short=make({starEnabled:true,starDuration:1.1}),long=make({starEnabled:true,starDuration:2.2});
for(let i=0;i<13;i++){short.step(1/60);long.step(1/60);}
const shortStar=short.sparkles.find(q=>q.active),longStar=long.sparkles.find(q=>q.active);
assert.ok(shortStar&&longStar);assert.equal(longStar.life,shortStar.life*2);
short.sparkleCountdown=long.sparkleCountdown=999;
for(let i=0;i<Math.ceil(shortStar.life*60);i++){short.step(1/60);long.step(1/60);}
assert.equal(shortStar.active,false);assert.equal(longStar.active,true,'longer star survives after the default star fades');
const backgroundStops=scene=>{
  let first;const c=new Proxy({createRadialGradient:()=>{const gradient={stops:[],addColorStop(at,color){this.stops.push([at,color]);}};first??=gradient;return gradient;}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  scene.drawBackground(c);return first.stops;
};
assert.deepEqual(backgroundStops(base),[[0,'#080915'],[.6,'#101126'],[1,'#24223f']]);
const recolored=make(advanced);
assert.equal(backgroundStops(recolored)[0][1],'#102030');assert.equal(backgroundStops(recolored).at(-1)[1],'#607080');
recolored.resize(844,390);assert.equal(backgroundStops(recolored)[0][1],'#102030');
const extremes=make({dotDepth:200,mistDrift:200,starDuration:3.5,dotOpacity:150,mistOpacity:150});
extremes.down(1);for(let i=0;i<300;i++){extremes.step(1/60);extremes.draw();}
// Already approved device settings migrate colors without a new appearance reset.
const oldColors={dotCount:115,mistColor1:'#123456',mistColor2:'#abcdef',mistColor3:'#654321',
  dotColor:'#456789',starBlue:false,starPurple:true,starWhite:false,starColor2:'#AABBCC',
  trailBlue:false,trailPurple:false,trailWhite:true,trailColor3:'#FEDCBA',backgroundOuter:'#112233'};
const oldRaw=JSON.stringify({version:1,appearanceRevision:2,values:oldColors});
const migrated=E.load({getItem:()=>oldRaw});
assert.deepEqual(migrated.mistPalette,['#123456','#abcdef','#654321']);
assert.deepEqual(migrated.dotPalette,['#456789']);assert.deepEqual(migrated.starPalette,['#aabbcc']);
assert.deepEqual(migrated.trailPalette,['#fedcba']);
assert.deepEqual(migrated.flashPalette,['#aabbcc']);assert.deepEqual(migrated.burstStarPalette,['#aabbcc']);
assert.equal(migrated.dotCount,115);assert.equal(migrated.backgroundOuter,'#112233');
assert.deepEqual(E.loadDefaults({getItem:()=>JSON.stringify({version:1,values:oldColors})}),migrated);
for(const k of Object.keys(E.fields).filter(k=>E.fields[k].type==='palette')){
  assert.deepEqual(E.normalize({[k]:[]})[k],E.defaults[k],'empty pool has a safe fallback');
  assert.deepEqual(E.normalize({[k]:['invalid','#ABCDEF',null]})[k],['#abcdef']);
  assert.equal(E.normalize({[k]:Array(100).fill('#123456')})[k].length,E.paletteLimit);
  const input=['#abcdef'],n=E.normalize({[k]:input});input[0]='#000000';
  assert.equal(n[k][0],'#abcdef','normalized pools own their arrays');
  assert.ok(Object.isFrozen(E.defaults[k]));
}
const savedPalette={...E.defaults,flashPalette:['#ff0000','#00ff00','#0000ff','#aabbcc'],flashCount:54,burstDuration:3.4};
E.saveDefaults(presetStorage,savedPalette);E.save(storage,savedPalette);
assert.deepEqual(E.load(storage),savedPalette);assert.deepEqual(E.loadDefaults(presetStorage),savedPalette);
const paletteReset=E.resetGroup({...savedPalette,flashCount:2,flashPalette:['#ffffff'],dotCount:80},'flashes',E.loadDefaults(presetStorage));
assert.equal(paletteReset.flashCount,54);assert.deepEqual(paletteReset.flashPalette,savedPalette.flashPalette);assert.equal(paletteReset.dotCount,80);
console.log('Effect settings: persistence, validation, isolated resets, render controls, bounded extremes and speed ramps passed.');
