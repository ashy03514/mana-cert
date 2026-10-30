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
 host.style.fontSize='52px';host.style.top='200px';host.style.left='50%';
 return ranks.map(rank=>{RankLettering.apply(host,rank);const art=host.querySelector('.rankArtwork'),text=host.querySelector('.rankText');
  return {rank,text:host.textContent,artDisplay:getComputedStyle(art).display,image:getComputedStyle(art).backgroundImage,
   artWidth:art.getBoundingClientRect().width,artHeight:art.getBoundingClientRect().height,
   textClip:getComputedStyle(text).clipPath,textPosition:getComputedStyle(text).position,textWidth:text.getBoundingClientRect().width,
   hiddenArt:art.getAttribute('aria-hidden')};});
 },ranks);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});await freezeFrames(context);
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);assert.equal(await page.evaluate(()=>RankLettering.ready),true);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{polling:100});
  const cached=await page.evaluate(async cacheName=>{const cache=await caches.open(cacheName);return {asset:!!await cache.match('./assets/rank-lettering-concept-v1.png'),module:!!await cache.match('./js/rank-lettering.js')};},cacheName);
  assert.deepEqual(cached,{asset:true,module:true});
  await context.setOffline(true);await page.reload();assert.equal(await page.evaluate(()=>RankLettering.ready),true,'rank sheet decodes after offline reload');
  for(const item of await inspectRanks(page)){
   assert.equal(item.text,item.rank);assert.equal(item.artDisplay,'block');assert.ok(item.image.includes('rank-lettering-concept-v1.png'));
   assert.ok(item.artWidth>20&&item.artHeight>20);assert.equal(item.hiddenArt,'true');assert.equal(item.textWidth,1);assert.notEqual(item.textClip,'none');
  }
  const image=await page.evaluate(async()=>{const img=new Image();img.src=RankLettering.source;await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
  assert.deepEqual(image,{width:1536,height:1024});assert.deepEqual(errors,[]);await context.close();

  const failure=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await freezeFrames(failure);
  const bad=await failure.newPage(),badErrors=[];bad.on('pageerror',e=>badErrors.push(String(e)));
  await bad.route('**/assets/rank-lettering-concept-v1.png',route=>route.abort('failed'));
  await bad.goto(url);assert.equal(await bad.evaluate(()=>RankLettering.ready),false,'asset failure resolves without breaking host');
  assert.equal(await bad.evaluate(()=>document.documentElement.classList.contains('rankArtReady')),false);
  for(const item of await inspectRanks(bad)){
   assert.equal(item.text,item.rank);assert.equal(item.artDisplay,'none');assert.equal(item.textClip,'none');assert.ok(item.textWidth>20,'plain rank remains visibly sized');
  }
  assert.equal(await bad.evaluate(()=>{const host=document.getElementById('fireScanRank');RankLettering.apply(host,'—');return host.textContent;}),'—');
  assert.deepEqual(badErrors,[]);await failure.close();
  console.log(`PASS ${cacheName}: rank PNG/module cached, seven readable rank sprites offline, 1536x1024 image decode, failed-PNG text fallback, unchanged rank text, no JS errors.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
