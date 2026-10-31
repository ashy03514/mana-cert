'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cacheName=fs.readFileSync(path.resolve(__dirname,'../service-worker.js'),'utf8').match(/const CACHE_NAME = "([^"]+)"/)[1];
const version=cacheName.match(/(\d+)$/)[1];
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
  await page.goto('http://127.0.0.1:8795/index.html?v='+version);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const expected=['./js/dark-awakening.js','./js/dark-demon-wing-motion.js','./js/dark-demon-wing-motion-renderer.js','./js/dark-demon-wing-growth-renderer.js','./js/dark-rank-growth.js','./assets/dark-demon-wings-ss-v2.local.js','./assets/dark-demon-wings-ranks.local.js','./assets/dark-chain-v1.local.js'];
  const cache=await page.evaluate(async ({expected,cacheName})=>{const names=await caches.keys(),cache=await caches.open(cacheName);return {names,assets:await Promise.all(expected.map(async url=>({url,cached:!!await cache.match(url)})))};},{expected,cacheName});
  assert.ok(cache.names.includes(cacheName));for(const a of cache.assets)assert.equal(a.cached,true,'offline cache contains '+a.url);
  await context.setOffline(true);await page.reload();
  const outcomes=await page.evaluate(async()=>{
   const r=new DarkDemonWingGrowthRenderer();if(!await r.ready)throw Error(r.error||'assets not ready');
   const c=document.createElement('canvas');c.width=390;c.height=844;const ctx=c.getContext('2d'),out=[];
   DarkAwakening.draw(ctx,{width:390,height:844,elapsed:2.35});
   if(DarkAwakening.error)throw Error(DarkAwakening.error);
   DarkAwakening.dispose();
   if(!ctx.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))throw Error('Offline awakening is empty');
   for(const [rank,mana]of [['A',750],['S',900],['SS',999]]){
    const sample=DarkRankGrowth.sample(10,{element:'暗',rank,mana}),layout=DarkRankGrowth.layout(390,844,1);
    const ok=r.draw(ctx,390,844,{time:10,box:layout.box,rank,growth:sample.growth,motionTime:sample.time,growthTransition:sample.transition,growthExposure:sample.exposure});
    out.push({rank,ok,error:r.error,layer:r.layerState,gl:r.gl?.getError()});
   }
   const assets=Object.entries(r.images).map(([rank,image])=>({rank,width:image.naturalWidth,embedded:image.src.startsWith('data:')}));r.dispose();return {out,assets};
  });
  for(const r of outcomes.out){assert.equal(r.ok,true);assert.equal(r.error,'');assert.equal(r.gl,0);assert.equal(r.layer.to,r.rank);assert.equal(r.layer.exposure,0);}
  assert.deepEqual(outcomes.assets.map(a=>a.rank).sort(),['A','S','SS']);for(const a of outcomes.assets){assert.ok(a.width>500);assert.equal(a.embedded,true);}
  assert.deepEqual(errors,[]);console.log('PASS dark PWA offline: cached awakening/renderer/timing, embedded three wing assets and chains, correct settled A/S/SS images.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
