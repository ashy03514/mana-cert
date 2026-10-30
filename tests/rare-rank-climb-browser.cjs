'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{let id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);window.tick=()=>{const list=[...jobs.values()];jobs.clear();list.forEach(fn=>fn(performance.now()));};});
 await page.goto('http://127.0.0.1:8795/index.html?v=127');await page.evaluate(()=>RankLettering.ready);
 await page.evaluate(()=>{
  const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.testFlow=this;return reset.apply(this,args);};
  const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(settings){begin.call(this,settings);this.currentResult=Object.freeze({type:'magic',element:window.target,rank:'SS',mana:999});window.testSession=this;return this.currentResult;};
  // Exercise real readout and flow wiring; the wing shader itself is unchanged.
  for(const C of [ElementMaterialRenderer,LightAngelLayeredGrowthRenderer,DarkDemonWingGrowthRenderer])C.prototype.draw=()=>true;
 });
 for(const element of ['光','暗']){
  await page.evaluate(e=>window.target=e,element);assert.equal(await page.locator('#btnStart').isVisible(),true);await page.locator('#btnStart').click({force:true});
  const history=await page.evaluate(()=>{
   const out=[];for(const t of [.3,1,1.3,1.5,1.8,2,2.2,2.5,3,4,6]){testFlow.state='REVEAL';testFlow.elapsed=t;tick();out.push({rank:fireScanRank.textContent,art:fireScanRank.dataset.rank,value:Number(fireScanValue.textContent)});}return out;
  });
  for(const rank of ['E','D','C','B','A','S','SS'])assert.ok(history.some(frame=>frame.rank===rank),element+' shows '+rank);
  assert.ok(history.every(frame=>frame.art===frame.rank));assert.equal(history.at(-1).value,999);
  assert.equal(await page.locator('#effectPreviewBack').isVisible(),false);
  assert.equal(await page.locator('#formalReplay').isVisible(),true);
  assert.equal(await page.evaluate(()=>testSession.currentResult.rank),'SS');
  const star=await page.locator('#formalReplay').boundingBox();await page.mouse.click(star.x+star.width/2,star.y+star.height/2);await page.locator('#btnGoHome').click({force:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS v127 formal light/dark readouts traverse E-D-C-B-A-S-SS with matching artwork, final 999, hidden back button and completed result menu.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});



