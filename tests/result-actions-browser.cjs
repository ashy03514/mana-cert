const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{let t=0,id=0;const jobs=new Map();requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};cancelAnimationFrame=id=>jobs.delete(id);Object.defineProperty(performance,'now',{value:()=>t});window.tick=()=>{t+=16;const a=[...jobs.values()];jobs.clear();a.forEach(f=>f(t));};});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.evaluate(()=>{
  const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.testFlow=this;return reset.apply(this,args);};
  const begin=ManaResults.Session.prototype.begin;window.begins=0;window.target='暗';ManaResults.Session.prototype.begin=function(settings){begins++;begin.call(this,settings);this.currentResult=Object.freeze(target===null?{type:'muggle',element:null,rank:'MUGGLE',mana:5}:{type:'magic',element:target,rank:'SS',mana:9999});window.testSession=this;return this.currentResult;};
  // These checks concern result controls and lifecycle, not GPU art. Retain
  // real host clocks, result data and DOM while avoiding repeated shader work.
  for(const C of [ElementMaterialRenderer,WaterOceanReveal,WindTornadoRenderer,EarthMountainRenderer,LightAngelLayeredGrowthRenderer,DarkDemonWingGrowthRenderer])C.prototype.draw=()=>true;
 });
 const click=id=>page.locator('#'+id).click();
 for(const element of ['火','水','風','土','光','暗',null]){
  await page.evaluate(e=>target=e,element);await click('btnStart');
  assert.equal(await page.locator('#formalReplay').isVisible(),false);assert.equal(await page.locator('#effectPreviewBack').isVisible(),true);
  await page.evaluate(()=>{testFlow.state='REVEAL';testFlow.elapsed=20;tick();});
  assert.equal(await page.locator('#effectPreviewBack').isVisible(),false);assert.equal(await page.locator('#formalReplay').isVisible(),true);
  const snapshot=await page.evaluate(()=>({result:testSession.currentResult,begins}));
  await click('formalReplay');assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),true);assert.equal(await page.locator('#btnGoHome').textContent(),'返回設定');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'btnGoHome');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'btnRetryCert');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'btnGoHome');
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'formalReplay');
  await click('formalReplay');await page.mouse.click(4,4);assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>({result:testSession.currentResult,begins})),snapshot,'opening/closing never rerolls result');
  if(element==='暗'){
   for(const [width,height]of [[390,844],[320,568],[844,390]]){await page.setViewportSize({width,height});await page.evaluate(()=>tick());const b=await page.locator('#formalReplay').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);await click('formalReplay');const d=await page.getByRole('dialog',{name:'鑑定後操作'}).boundingBox();assert.ok(d.x>=0&&d.y>=0&&d.x+d.width<=width&&d.y+d.height<=height);await page.screenshot({path:path.resolve(`artifacts/result-actions-${width}x${height}.png`)});await page.keyboard.press('Escape');}
   await page.setViewportSize({width:390,height:844});
  }
  await click('formalReplay');await click('btnRetryCert');assert.equal(await page.evaluate(()=>begins),snapshot.begins+1);assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),false);assert.equal(await page.locator('#formalReplay').isVisible(),false);assert.equal(await page.evaluate(()=>document.querySelector('#animLayer').inert),false);
  await page.evaluate(()=>{testFlow.state='REVEAL';testFlow.elapsed=20;tick();});await click('formalReplay');await click('btnGoHome');
  assert.equal(await page.locator('body').getAttribute('data-state'),'SETTINGS');assert.equal(await page.getByRole('dialog',{name:'鑑定後操作'}).isVisible(),false);assert.equal(await page.evaluate(()=>testSession.currentResult),null);
 }
 assert.deepEqual(errors,[]);console.log('PASS all six elements and muggle: completed controls, modal actions, focus trap, Escape/outside dismissal, immutable result, retry/reset and three layouts.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
