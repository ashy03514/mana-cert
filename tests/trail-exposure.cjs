const assert=require('node:assert/strict');
require('../js/config.js');require('../js/magic-interaction.js');require('../js/particle-renderer.js');
const field=new MagicField(ManaConfig.interaction,390,844,()=>.43);
let strokes=0,stamps=0;
const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:k==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{
  if(k==='stroke'){
    strokes++;assert.equal(o.globalCompositeOperation,'lighter');assert.ok(o.globalAlpha<=.3*.75);
  }
  if(k==='drawImage'&&args[3]>40&&o.globalAlpha>0){
    stamps++;assert.equal(o.globalCompositeOperation,'lighter');assert.equal(o.globalAlpha,.25*.75);
  }
}});
const renderer=new MagicRenderer(ctx,field,()=>({getContext:()=>ctx}));
field.down(1,100,400,0);
for(let i=1;i<100;i++){field.move(1,100+Math.sin(i*.2)*30,400+Math.cos(i*.2)*30,i*16);field.step(.016);}
field.release();for(let i=0;i<30;i++)field.step(1/60);
// Isolate fully visible retained ink from other scene layers.
field.particles=[];field.touchParticles=[];
for(const t of field.trails)if(t.life>0){t.life=ManaConfig.interaction.trailLife;t.width=18;}
renderer.nebula=()=>{};renderer.drawMist=()=>{};renderer.draw(0,0,null,{weight:1,time:0});
assert.ok(strokes>100);assert.ok(stamps>100,'original broad glow stamps are retained');
assert.equal(ManaConfig.interaction.trailLife,3);
console.log('Trail checks passed: additive glow and ribbons retained at 75% brightness, three-second lifetime.');
