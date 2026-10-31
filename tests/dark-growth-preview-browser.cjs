'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
  await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();Object.defineProperty(performance,'now',{value:()=>now});requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
   window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...callbacks.values()];callbacks.clear();run.forEach(fn=>fn(now));}while(ms>0);};});
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.evaluate(()=>{const Base=DarkDemonWingGrowthRenderer;window.DarkDemonWingGrowthRenderer=class extends Base{constructor(){super();window.darkPreview=this;}};});
  await page.locator('#tab_effects').click();await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#materialPreviewOpen').click();await page.locator('#material_dark').click();
  await page.waitForFunction(()=>darkPreview.loaded||darkPreview.error,null,{polling:100});
  for(const rank of ['A','S','SS']){
   await page.locator('#darkRank_'+rank).click();await page.evaluate(()=>advance(650));
   assert.equal(await page.locator('#darkRank_'+rank).getAttribute('aria-pressed'),'true');
   const state=await page.evaluate(()=>({layer:darkPreview.layerState,error:darkPreview.error,gl:darkPreview.gl.getError(),time:darkPreview.lastSample.time}));
   assert.equal(state.layer.to,rank);assert.equal(state.error,'');assert.equal(state.gl,0);
   if(rank==='A'){
    assert.ok(Math.abs(state.time-.6*.70)<1e-8,'active timeline and supplied RAF timestamps share the same deterministic clock');
    assert.equal(state.layer.birth,true);assert.ok(state.layer.progress>0&&state.layer.progress<1,'direct A preview uses the same root-out first appearance');
    assert.equal(state.layer.exposure,1,'A keeps its violet flame veil during formation');
   }else{assert.equal(state.layer.progress,1);assert.equal(state.layer.exposure,0);}
   await page.locator('#materialPause').click();await page.evaluate(()=>advance(250));assert.equal(await page.evaluate(()=>darkPreview.lastSample.time),state.time);
   await page.locator('#materialPause').click();await page.evaluate(()=>advance(100));assert.ok(await page.evaluate(()=>darkPreview.lastSample.time)>state.time);
   if(rank==='A'){
    await page.evaluate(()=>advance(1100));const settled=await page.evaluate(()=>darkPreview.layerState);
    assert.equal(settled.to,'A');assert.equal(settled.progress,1);assert.equal(settled.exposure,0,'A material settles after the complete silhouette emerges');
   }
  }
  await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>darkPreview.lastSample.time),0);
  await page.locator('#effectPreviewBack').click();assert.equal(await page.evaluate(()=>darkPreview.disposed),true);assert.equal(await page.evaluate(()=>darkPreview.growthProgram),null);
  const cancelled=await page.evaluate(async()=>{const r=new DarkDemonWingGrowthRenderer();r.dispose();return await r.ready;});assert.equal(cancelled,false);
  assert.deepEqual(errors,[]);console.log('PASS direct dark rank selectors, pause/resume/replay, resource disposal and cancellation during image loading.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
