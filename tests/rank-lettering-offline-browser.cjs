'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync(path.resolve(__dirname,'../service-worker.js'),'utf8');
const cacheName=source.match(/const CACHE_NAME = "([^"]+)"/)[1],version=cacheName.match(/(\d+)$/)[1];
const url='http://127.0.0.1:8795/index.html?v='+version;
const ranks=['E','D','C','B','A','S','SS'];
async function freezeFrames(context){await context.addInitScript(()=>{requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};});}
async function inspectRanks(page){return page.evaluate(ranks=>{
 const host=document.getElementById('fireScanRank');document.getElementById('fireScanReadout').hidden=false;
 host.style.fontSize='62.4px';host.style.top='250px';host.style.left='50%';
 return ranks.map(rank=>{RankLettering.apply(host,rank,3.75);const text=host.querySelector('.rankText'),stars=host.querySelectorAll('.rankSpark'),layer=host.querySelector('.rankSparkles');
  return {rank,text:host.textContent,color:getComputedStyle(text).color,display:getComputedStyle(text).display,
   textClip:getComputedStyle(text).clipPath,textWidth:text.getBoundingClientRect().width,textHeight:text.getBoundingClientRect().height,
   imageCount:host.querySelectorAll('img,.rankArtwork').length,background:getComputedStyle(text).backgroundImage,
   stars:stars.length,decorative:!layer||layer.getAttribute('aria-hidden')==='true'};});
 },ranks);}
function checkReadouts(items){
 for(const item of items){
  assert.equal(item.text,item.rank);assert.equal(item.color,'rgb(255, 255, 255)');assert.notEqual(item.display,'none');
  assert.equal(item.textClip,'none');assert.ok(item.textWidth>20&&item.textHeight>20,'plain rank remains visibly sized');
  assert.equal(item.imageCount,0);assert.equal(item.background,'none');assert.equal(item.decorative,true,'stars do not add accessible text');
 }
 assert.ok(items.at(-1).stars>items[0].stars,'higher ranks have more decorative stars');
 for(let i=1;i<items.length;i++)assert.ok(items[i].stars>=items[i-1].stars,'star counts do not decrease with rank');
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});await freezeFrames(context);
  const page=await context.newPage(),errors=[],rankImageRequests=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',request=>{if(request.url().includes('rank-lettering-concept'))rankImageRequests.push(request.url());});
  await page.goto(url);assert.equal(await page.evaluate(()=>RankLettering.ready),true);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{polling:100});
  const cached=await page.evaluate(async cacheName=>{const cache=await caches.open(cacheName);return {asset:!!await cache.match('./assets/rank-lettering-concept-v1.png'),module:!!await cache.match('./js/rank-lettering.js')};},cacheName);
  assert.deepEqual(cached,{asset:false,module:true},'new offline cache keeps the runtime but no generated rank image');
  await context.setOffline(true);await page.reload();assert.equal(await page.evaluate(()=>RankLettering.ready),true);
  checkReadouts(await inspectRanks(page));assert.deepEqual(rankImageRequests,[]);assert.deepEqual(errors,[]);await context.close();

  const independent=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await freezeFrames(independent);
  const direct=await independent.newPage(),directErrors=[];let blockedRankImages=0;direct.on('pageerror',e=>directErrors.push(String(e)));
  await direct.route('**/assets/rank-lettering*',route=>{blockedRankImages++;return route.abort('failed');});
  await direct.goto(url);assert.equal(await direct.evaluate(()=>RankLettering.ready),true);
  checkReadouts(await inspectRanks(direct));assert.equal(blockedRankImages,0,'rank display has no image dependency');
  const reset=await direct.evaluate(()=>{const host=document.getElementById('fireScanRank');RankLettering.apply(host,'—',0);return {text:host.textContent,stars:host.querySelectorAll('.rankSpark').length};});
  assert.deepEqual(reset,{text:'—',stars:0});assert.deepEqual(directErrors,[]);await independent.close();
  console.log(`PASS ${cacheName}: runtime cached without rank PNG, E-SS white text and increasing decorative stars offline, no image request/dependency, accessible text, reset cleanup and no JS errors.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
