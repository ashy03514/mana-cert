'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
    await page.goto('http://127.0.0.1:8795/index.html');
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cached=await page.evaluate(async()=>{
      const names=await caches.keys(),cache=await caches.open('mana-pwa-v3-portal-114');
      return {names,renderer:!!await cache.match('./js/light-angel-layered-growth-renderer.js'),timing:!!await cache.match('./js/light-rank-growth.js'),awakening:!!await cache.match('./js/light-awakening.js'),feathers:!!await cache.match('./js/light-feathers.js'),featherAsset:!!await cache.match('./assets/light-angel-feather-v1.local.js'),featherPng:!!await cache.match('./assets/light-angel-feather-v1.png')};
    });
    assert.ok(cached.names.includes('mana-pwa-v3-portal-114'));assert.equal(cached.renderer,true);assert.equal(cached.timing,true);
    assert.equal(cached.awakening,true);assert.equal(cached.feathers,true);assert.equal(cached.featherAsset,true);assert.equal(cached.featherPng,true);
    await context.setOffline(true);await page.reload();
    const rendered=await page.evaluate(async()=>{
      const renderer=new LightAngelLayeredGrowthRenderer();await renderer.ready;await LightFeathers.ready;
      const canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;const results=[];
      LightAwakening.draw(canvas.getContext('2d'),{width:390,height:844,elapsed:1.6});
      if(!LightFeathers.draw(canvas.getContext('2d'),{width:390,height:844,time:1,bursts:[{at:0,kind:'awakening',x:195,y:330}]}).length)throw new Error('Offline feathers missing');
      for(const [rank,mana] of [['A',750],['S',950],['SS',9999]]){
        const effects=LightRankGrowth.sample(10,{rank,mana,element:'光'});
        const ok=renderer.draw(canvas.getContext('2d'),390,844,{time:10,motionTime:effects.time,rank,growth:effects.growth,growthTransition:effects.transition,growthExposure:effects.exposure});
        results.push({rank,ok,error:renderer.error,layer:renderer.layerState,gl:renderer.gl?.getError()});
      }
      renderer.dispose();return results;
    });
    for(const result of rendered){assert.equal(result.ok,true);assert.equal(result.error,'');assert.equal(result.gl,0);assert.equal(result.layer.to,result.rank);assert.equal(result.layer.exposure,0);}
    assert.deepEqual(errors,[]);console.log('PASS v114 PWA: generated feather PNG/embedded asset cached and decoded offline, renderer/timing ready, embedded A/S/SS assets render at correct settled endpoints.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
