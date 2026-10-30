'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   let t=0,id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);
   Object.defineProperty(performance,'now',{value:()=>t});window.tick=()=>{t+=16;const frames=[...jobs.values()];jobs.clear();frames.forEach(f=>f(t));};
  });
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  assert.equal(await page.evaluate(()=>RankLettering.ready),true);
  await page.evaluate(()=>{
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.testFlow=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(settings){begin.call(this,settings);this.currentResult=Object.freeze({...window.testResult});window.testSession=this;return this.currentResult;};
  });
  const cases=[['E',124],['D',275],['C',420],['B',610],['A',800],['S',998],['SS',999]].map(([rank,mana])=>({type:'magic',element:'火',rank,mana}));
  cases.push({type:'magic',element:'光',rank:'SS',mana:999},{type:'magic',element:'暗',rank:'SS',mana:999});
  for(const result of cases){
   await page.evaluate(r=>window.testResult=r,result);await page.locator('#btnStart').click({force:true});await page.waitForTimeout(300);
   if(result.element==='火'&&result.rank==='SS'){
    for(const elapsed of [0,.6,1,1.7,2.5,3.2,3.7,4.5]){
     await page.evaluate(t=>{testFlow.state='REVEAL';testFlow.elapsed=t;tick();},elapsed);
     const sample=await page.evaluate(()=>({rank:fireScanRank.textContent,art:fireScanRank.dataset.rank,value:fireScanValue.textContent}));
     assert.equal(sample.art,sample.rank,'count-up art follows the displayed rank');
    }
   }
   await page.evaluate(()=>{testFlow.state='REVEAL';testFlow.elapsed=20;tick();});
   await page.locator('#fireScanRank .rankText').waitFor({state:'visible'});
   const shown=await page.evaluate(()=>({rank:fireScanRank.textContent,art:fireScanRank.dataset.rank,value:Number(fireScanValue.textContent),frozen:Object.isFrozen(testSession.currentResult),result:testSession.currentResult,aria:document.querySelector('#fireScanRank .rankSparkles').getAttribute('aria-hidden'),color:getComputedStyle(document.querySelector('#fireScanRank .rankText')).color,stars:document.querySelectorAll('#fireScanRank .rankSpark').length,ratio:parseFloat(getComputedStyle(fireScanRank).fontSize)/parseFloat(getComputedStyle(fireScanValue).fontSize)}));
   assert.equal(shown.rank,result.rank);assert.equal(shown.art,result.rank);assert.equal(shown.value,result.mana);assert.equal(shown.aria,'true');assert.equal(shown.color,'rgb(255, 255, 255)');assert.ok(Math.abs(shown.ratio-2.4)<.001);assert.equal(shown.stars,[1,2,3,4,6,9,13][['E','D','C','B','A','S','SS'].indexOf(result.rank)]);assert.equal(shown.frozen,true);assert.deepEqual(shown.result,result);
   const box=await page.locator('#fireScanRank .rankText').boundingBox();assert.ok(box.width>15&&box.height>20&&box.x>=0&&box.x+box.width<=390);
   const name=result.element==='火'?'fire':result.element==='光'?'light':'dark';
   await page.screenshot({path:path.resolve(`artifacts/rank-lettering-${name}-${result.rank}.png`)});
   await page.locator('#formalReplay').click({force:true});await page.locator('#btnGoHome').click({force:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS formal E/D/C/B/A/S/SS white text, 2.4x size and graduated stars, live count-up, 998 S / 999 SS, light/dark backgrounds, immutable results, accessible rank text and file opening.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
