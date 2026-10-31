'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
  await page.addInitScript(()=>{
   let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});
   requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(now));}while(ms>0);};
  });
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.evaluate(()=>{
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.f=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(...args){window.session=this;window.outcome=begin.apply(this,args);return outcome;};
   const Original=DarkDemonWingGrowthRenderer;window.realPaint=true;window.wingDraws=0;
   window.DarkDemonWingGrowthRenderer=class extends Original{constructor(){super();window.r=this;}draw(...args){wingDraws++;window.lastWingArgs=args;return realPaint?super.draw(...args):true;}};
   window.cues=[];const play=AudioManager.prototype.play;AudioManager.prototype.play=function(slot){cues.push(slot);return play.call(this,slot);};
   window.hash=()=>document.querySelector('canvas').toDataURL();
   const dark=DarkAwakening;window.DarkAwakening={...dark,get error(){return dark.error;},get lost(){return dark.lost;},draw(ctx,args){window.awakeningTarget=args.target;return dark.draw(ctx,args);}};
   window.frameStats=()=>{
    const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let total=0,hash=2166136261,count=0,inner=0,innerCount=0,around=0,aroundCount=0;
    const sx=canvas.width/innerWidth,sy=canvas.height/innerHeight,target=awakeningTarget,unit=Math.min(innerWidth,innerHeight);
    // Read the rendered canvas, excluding DOM controls. Sparse pixel samples
    // avoid a screenshot file comparison while still catching empty frames.
    for(let p=0;p<canvas.width*canvas.height;p+=7){const i=p*4;const luma=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;total+=luma;count++;hash=Math.imul(hash^Math.round(luma),16777619)>>>0;
     const radius=Math.hypot((p%canvas.width)/sx-target.x,Math.floor(p/canvas.width)/sy-target.y);
     if(radius<unit*.05){inner+=luma;innerCount++;}else if(radius>unit*.14&&radius<unit*.25){around+=luma;aroundCount++;}
    }
    return {mean:total/count,hash,core:inner/innerCount,annulus:around/aroundCount};
   };
  });
  await page.locator('#s_master').uncheck({force:true});await page.locator('#s_dark').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
  await page.locator('#tab_probabilities').click();await page.locator('#rareChance_SS').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#btnStart').click();await page.waitForFunction(()=>r.loaded,null,{polling:100});
  const sketch=async()=>{await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(240,365,{steps:8});await page.mouse.up();};
  const awaken=async()=>{for(let i=0;i<100;i++){await page.evaluate(()=>advance(50));if(await page.evaluate(()=>f.state==='AWAKEN'))return;}throw Error('Awakening not entered');};
  await sketch();await awaken();
  assert.equal(await page.evaluate(()=>session.state),'GATHER');assert.equal(await page.evaluate(()=>f.materialFrame),null);
  assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.equal(await page.locator('#revealTitle').isVisible(),false);
  assert.equal(await page.evaluate(()=>wingDraws),0);assert.equal(await page.evaluate(()=>cues.filter(x=>x==='darkAwaken').length),1);assert.equal(await page.evaluate(()=>cues.includes('lightAwaken')),false);
  const saved=await page.evaluate(()=>JSON.stringify(outcome));
  await page.evaluate(()=>{f.paused=true;f.elapsed=.7;advance(0);});const held=await page.evaluate(()=>hash());
  await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>hash()),held);
  await page.evaluate(()=>{f.paused=false;dispatchEvent(new Event('pagehide'));});const time=await page.evaluate(()=>f.elapsed);
  await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>f.elapsed),time);
  await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));f.paused=true;});
  for(const [width,height]of [[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));
   const snapshots={};
   for(const [name,time]of [['illuminate',.25],['suction',.95],['swallowed',1.55],['flames',2.35]]){
    await page.evaluate(time=>{f.state='AWAKEN';f.elapsed=time;advance(0);},time);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.equal(await page.locator('#revealTitle').isVisible(),false);
    snapshots[name]=await page.evaluate(()=>frameStats());
    assert.equal(await page.evaluate(()=>DarkAwakening.error),'','black flame shader compiles/draws');
    assert.equal(await page.evaluate(()=>DarkAwakening.lost),false);
    assert.equal(await page.evaluate(()=>wingDraws),0,'wings remain absent throughout the interlude');
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-'+name+'-'+width+'x'+height+'.png')});
   }
   assert.ok(snapshots.suction.core+10<snapshots.suction.annulus,'black core visibly occludes surrounding light');
   assert.equal(new Set(Object.values(snapshots).map(s=>s.hash)).size,4,'all four stages visibly differ');
   assert.ok(snapshots.illuminate.mean>snapshots.swallowed.mean+3,'the illuminated background visibly loses light');
   await page.evaluate(()=>{f.elapsed=.95;advance(0);});const inhale=await page.evaluate(()=>frameStats());
   await page.evaluate(()=>{f.elapsed=1.05;advance(0);});const moving=await page.evaluate(()=>frameStats());
   assert.notEqual(inhale.hash,moving.hash,'the swallowing phase continuously moves');
   console.log('Dark awakening '+width+'x'+height+' luminance:',JSON.stringify(snapshots));
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{dispatchEvent(new Event('resize'));f.state='AWAKEN';f.elapsed=2.65;f.paused=false;advance(50);});
  assert.equal(await page.evaluate(()=>f.state),'FORM');assert.equal(await page.evaluate(()=>session.state),'ELEMENT_REVEAL');
  assert.ok(await page.evaluate(()=>f.materialFrame.time<1e-7));
  await page.evaluate(()=>advance(400));await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-handoff.png')});
  assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.ok(await page.evaluate(()=>wingDraws>0));
  assert.equal(await page.evaluate(()=>r.error),'');assert.equal(await page.evaluate(()=>r.gl.getError()),0);
  await page.evaluate(()=>{realPaint=false;advance(12000);realPaint=true;advance(0);});
  assert.equal(await page.evaluate(()=>session.currentResult===outcome&&Object.isFrozen(outcome)),true);assert.equal(await page.evaluate(()=>JSON.stringify(outcome)),saved);
  assert.equal(await page.locator('#fireScanValue').textContent(),'999');assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
  assert.equal(await page.evaluate(()=>cues.filter(x=>x==='darkAwaken').length),1);
  assert.equal(await page.locator('#formalReplay').isVisible(),true);
  await page.locator('#formalReplay').click({force:true});
  assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),true);
  await page.locator('#btnGoHome').click({force:true});
  await page.locator('#tab_effects').click();await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#flowPreviewOpen').click();await page.locator('#material_dark').click();
  await page.waitForFunction(()=>r.loaded,null,{polling:100});await sketch();await awaken();
  await page.locator('#materialPause').click();const paused=await page.evaluate(()=>f.elapsed);await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>f.elapsed),paused);
  await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>f.state),'DRAWING');assert.equal(await page.evaluate(()=>f.elapsed),0);
  await page.locator('#material_fire').click();assert.equal(await page.evaluate(()=>f.awakeningEnabled),false);
  await sketch();await page.evaluate(()=>{realPaint=false;advance(3900);});assert.equal(await page.evaluate(()=>f.state),'FORM');
  assert.deepEqual(errors,[]);
  console.log('PASS dark awakening: real stroke to illumination/suction/black flames to A wings to immutable SS999, no early readout/wings, unique cue, three viewports, pause/background/replay/basic pacing.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
