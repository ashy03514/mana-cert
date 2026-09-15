const assert=require('node:assert/strict');
require('../js/config.js');require('../js/element-effects.js');
const operations=[];let textures=0;
const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),'finite '+key);
  operations.push([key,...args]);
}});
const effects=new ElementEffects(ctx,ManaConfig.elementReveal,()=>{textures++;return {getContext:()=>ctx};});
const pool=effects.glows;
function render(element){operations.length=0;effects.draw(390,844,element,700);return operations.slice();}
const fire=render('火'),water=render('水'),wind=render('風'),earth=render('土'),light=render('光'),dark=render('暗');
assert.ok(fire.some(x=>x[0]==='quadraticCurveTo'),'fire has burning trails');
assert.ok(water.filter(x=>x[0]==='ellipse').length>=4,'water ripples');
assert.ok(wind.filter(x=>x[0]==='lineTo').length>300,'wind spiral streams');
assert.ok(earth.filter(x=>x[0]==='closePath').length>=14,'earth crystals');
assert.ok(light.filter(x=>x[0]==='closePath').length>=80&&light.some(x=>x[0]==='fillRect'),'light stars and columns');
assert.ok(dark.filter(x=>x[0]==='ellipse').length>30,'dark chains');
for(const calls of [fire,water,wind,earth,light,dark])assert.deepEqual(calls.find(x=>x[0]==='translate'),['translate',195,422]);
const realRandom=Math.random;Math.random=()=>{throw Error('reveals cannot reroll outcomes');};
try {
  for(let round=0;round<20;round++)for(const element of Object.keys(ManaConfig.elementReveal.colors))
    for(const elapsed of [0,300,600,1200,1999,2000])effects.draw(844,390,element,elapsed);
} finally{Math.random=realRandom;}
assert.equal(textures,6);assert.equal(effects.glows,pool);
operations.length=0;effects.draw(390,844,null,1000);
assert.deepEqual(operations,[['clearRect',0,0,390,844]],'muggle has no new element effect');
console.log('Stage 4 checks passed: six distinct FX, centered geometry, fixed textures, no RNG and no muggle effect.');
