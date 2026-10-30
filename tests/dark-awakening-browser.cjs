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
   for(const [name,time]of [['core',.3],['pressure',.85],['release',1.55]]){
    await page.evaluate(time=>{f.state='AWAKEN';f.elapsed=time;advance(0);},time);
    assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.equal(await page.locator('#revealTitle').isVisible(),false);
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-'+name+'-'+width+'x'+height+'.png')});
   }
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{dispatchEvent(new Event('resize'));f.state='AWAKEN';f.elapsed=1.85;f.paused=false;advance(50);});
  assert.equal(await page.evaluate(()=>f.state),'FORM');assert.equal(await page.evaluate(()=>session.state),'ELEMENT_REVEAL');
  assert.ok(await page.evaluate(()=>f.materialFrame.time<1e-7));
  await page.evaluate(()=>advance(400));await page.screenshot({path:path.resolve(__dirname,'../artifacts/dark-awakening-handoff.png')});
  assert.equal(await page.locator('#fireScanReadout').isVisible(),false);assert.ok(await page.evaluate(()=>wingDraws>0));
  assert.equal(await page.evaluate(()=>r.error),'');assert.equal(await page.evaluate(()=>r.gl.getError()),0);
  await page.evaluate(()=>{realPaint=false;advance(12000);realPaint=true;advance(0);});
  assert.equal(await page.evaluate(()=>session.currentResult===outcome&&Object.isFrozen(outcome)),true);assert.equal(await page.evaluate(()=>JSON.stringify(outcome)),saved);
  assert.equal(await page.locator('#fireScanValue').textContent(),'999');assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
  assert.equal(await page.evaluate(()=>cues.filter(x=>x==='darkAwaken').length),1);
  await require('./result-action-helpers.cjs')(page,'#effectPreviewBack');
  await page.locator('#tab_effects').click();await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#flowPreviewOpen').click();await page.locator('#material_dark').click();
  await page.waitForFunction(()=>r.loaded,null,{polling:100});await sketch();await awaken();
  await page.locator('#materialPause').click();const paused=await page.evaluate(()=>f.elapsed);await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>f.elapsed),paused);
  await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>f.state),'DRAWING');assert.equal(await page.evaluate(()=>f.elapsed),0);
  await page.locator('#material_fire').click();assert.equal(await page.evaluate(()=>f.awakeningEnabled),false);
  await sketch();await page.evaluate(()=>{realPaint=false;advance(3900);});assert.equal(await page.evaluate(()=>f.state),'FORM');
  assert.deepEqual(errors,[]);
  console.log('PASS dark awakening: real stroke to interlude to A wings to immutable SS999, no early readout/wings, unique cue, three viewports, pause/background/replay/basic pacing.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
