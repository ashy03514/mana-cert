'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const deps='C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
  page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{
   // Pixel assertions read the entire composited canvas repeatedly. Pin the
   // readback backend up front so Chrome cannot switch from GPU to CPU mid-
   // comparison (their gradient rounding differs). Production stays GPU-led.
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,options){return getContext.call(this,type,type==='2d'?{...options,willReadFrequently:true}:options);};
   let next=1,clock=0;const frames=new Map();
   window.requestAnimationFrame=callback=>{const id=next++;frames.set(id,callback);return id;};
   window.cancelAnimationFrame=id=>frames.delete(id);
   window.advanceDemon=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=50){clock+=Math.min(50,ms-elapsed);const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(clock));}};
   window.demonFrames=()=>frames.size;
   window.demonState=()=>{const s=window.darkDemonWingMotionStudy;return s.getState?s.getState():s.state;};
   window.demonHash=()=>{const c=document.querySelector('#demonWings'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<p.length;i++)h=Math.imul(h^p[i],16777619)>>>0;return h;};
  });
  await page.goto(pathToFileURL(path.join(root,'dark-demon-wing-motion-study.html')).href);
  await page.waitForFunction(()=>window.darkDemonWingMotionStudy&&(!demonState().loading||demonState().failed),null,{polling:100});
  assert.equal(await page.evaluate(()=>demonState().failed),false,'file:// preview loads successfully');
  assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.loaded),true);
  assert.equal(await page.evaluate(()=>DarkDemonWingAsset.startsWith('data:image/png;base64,')&&DarkChainAsset.startsWith('data:image/png;base64,')),true,'both textures embedded for local-file compatibility');
  const phaseFiles=[],phaseHashes=[];
  for(const time of [1.5,2.5,5.8,6.6]){
   assert.equal(await page.evaluate(t=>darkDemonWingMotionStudy.renderAt(t),time),true);
   assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.gl.getError()),0,'no GL error rendering '+time);
   phaseHashes.push(await page.evaluate(()=>demonHash()));
   const file=path.join(root,`artifacts/dark-demon-motion-phase-${time}.png`);await page.screenshot({path:file});phaseFiles.push(file);
  }
  assert.equal(new Set(phaseHashes).size,4,'charge, release and two idle poses are visibly different');
  const fixed=await page.evaluate(()=>demonHash());
  await page.evaluate(()=>advanceDemon(1000));assert.equal(await page.evaluate(()=>demonHash()),fixed,'paused pixels do not change');
  assert.equal(await page.evaluate(()=>demonFrames()),0,'pause does not leave a frame loop running');
  await page.evaluate(()=>{darkDemonWingMotionStudy.renderAt(.7);darkDemonWingMotionStudy.renderAt(6.6);});
  assert.equal(await page.evaluate(()=>demonHash()),fixed,'sampling the same time reproduces exact pose, particles and light');
  await page.locator('#chainsToggle').uncheck();assert.notEqual(await page.evaluate(()=>demonHash()),fixed,'chain ornaments draw separately');
  await page.locator('#chainsToggle').check();assert.equal(await page.evaluate(()=>demonHash()),fixed,'chain toggle preserves time and pose');
  const contact=createCanvas(390*4,844),c=contact.getContext('2d');
  for(let i=0;i<phaseFiles.length;i++)c.drawImage(await loadImage(phaseFiles[i]),i*390,0);
  fs.writeFileSync(path.join(root,'artifacts/dark-demon-motion-phases.png'),contact.toBuffer('image/png'));
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
   await page.setViewportSize(viewport);await page.evaluate(()=>darkDemonWingMotionStudy.resize());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
   for(const selector of ['#pause','#replay','#chainsToggle','[data-speed="1.5"]','[data-time]:last-of-type']){
    const b=await page.locator(selector).last().boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,`${selector} visible at ${viewport.width}x${viewport.height}`);
   }
   assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.gl.getError()),0);
   await page.screenshot({path:path.join(root,`artifacts/dark-demon-motion-${viewport.width}x${viewport.height}.png`)});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>darkDemonWingMotionStudy.resize());
  await page.locator('#replay').click();assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.time),0,'replay resets clock');
  await page.evaluate(()=>advanceDemon(150));assert.ok(Math.abs(await page.evaluate(()=>darkDemonWingMotionStudy.time)-.1)<1e-8,'clock advances by elapsed visible time');
  await page.locator('[data-speed="1.5"]').click();await page.evaluate(()=>advanceDemon(150));
  assert.ok(Math.abs(await page.evaluate(()=>darkDemonWingMotionStudy.time)-.25)<1e-8,'playback speed changes time rate');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));advanceDemon(1000);});
  assert.ok(Math.abs(await page.evaluate(()=>darkDemonWingMotionStudy.time)-.25)<1e-8,'hidden page freezes clock');
  assert.equal(await page.evaluate(()=>demonFrames()),0,'hidden page stops requesting frames');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));advanceDemon(100);});
  assert.ok(Math.abs(await page.evaluate(()=>darkDemonWingMotionStudy.time)-.325)<1e-8,'visibility return has no catch-up jump');
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));advanceDemon(1000);});
  assert.ok(Math.abs(await page.evaluate(()=>darkDemonWingMotionStudy.time)-.325)<1e-8,'pagehide freezes clock');
  assert.equal(await page.evaluate(()=>demonFrames()),0,'pagehide stops scheduling');
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));darkDemonWingMotionStudy.renderAt(5.8);});
  const recoveryHash=await page.evaluate(()=>demonHash());
  const contextLossAvailable=await page.evaluate(()=>{window.demonLoss=darkDemonWingMotionStudy.renderer.gl.getExtension('WEBGL_lose_context');return !!demonLoss;});
  if(contextLossAvailable){
   await page.evaluate(()=>demonLoss.loseContext());await page.waitForFunction(()=>demonState().waiting,null,{polling:100});
   await page.evaluate(()=>advanceDemon(1000));assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.time),5.8,'context loss preserves time');
   await page.evaluate(()=>demonLoss.restoreContext());await page.waitForFunction(()=>!demonState().waiting,null,{polling:100});
   assert.equal(await page.evaluate(()=>demonState().failed),false,'context restored without failure');
   assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.gl.getError()),0);
   assert.equal(await page.evaluate(()=>demonHash()),recoveryHash,'restored textures reproduce paused pose');
  }
  await page.evaluate(()=>darkDemonWingMotionStudy.renderAt(3600));assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.gl.getError()),0,'long-running sampling stays valid');
  await page.evaluate(()=>darkDemonWingMotionStudy.dispose());assert.equal(await page.evaluate(()=>demonFrames()),0,'dispose cancels scheduled frame');
  assert.equal(await page.evaluate(()=>demonState().disposed),true);
  assert.equal(await page.evaluate(()=>darkDemonWingMotionStudy.renderer.gl),null,'dispose releases WebGL resources');
  assert.deepEqual(errors,[]);assert.equal(requests.filter(url=>/^https?:/.test(url)).length,0,'no remote dependencies');
  console.log('PASS dark demon wing motion: embedded file textures, deterministic charge/release/living idle, chains, mobile/desktop controls, pause/replay/speed, visibility/BFCache, context recovery ('+contextLossAvailable+'), disposal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
