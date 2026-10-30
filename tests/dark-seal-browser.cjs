'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const deps='C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),{createCanvas,loadImage}=require(deps+'@napi-rs/canvas');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],files=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
  await page.addInitScript(()=>{let now=0,id=0;const frames=new Map();requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);window.advance=ms=>{for(let i=0;i<ms;i+=50){now+=50;const run=[...frames.values()];frames.clear();run.forEach(fn=>fn(now));}};});
  await page.goto(pathToFileURL(path.resolve('dark-seal-study.html')).href);await page.waitForFunction(()=>darkSealStudy.getState().ready||darkSealStudy.getState().failed,null,{polling:100});
  assert.equal(await page.evaluate(()=>darkSealStudy.getState().failed),false);
  const asset=await page.evaluate(()=>({bounds:darkSealStudy.renderer.textureBounds,embedded:darkSealStudy.renderer.image.src.startsWith('data:')}));assert.ok(asset.bounds.width>1000&&asset.bounds.height>50&&asset.bounds.height<300);assert.equal(asset.embedded,true);
  for(const t of [1.8,2.7,3.25,5]){
   await page.evaluate(t=>darkSealStudy.renderAt(t),t);assert.equal(await page.evaluate(()=>darkSealStudy.renderer.gl.getError()),0);
   const file=path.resolve(`artifacts/dark-seal-phase-${t}.png`);await page.screenshot({path:file});files.push(file);
  }
  const pixels=()=>page.evaluate(()=>document.querySelector('#darkSeal').toDataURL());
  const paused=await pixels();await page.evaluate(()=>advance(500));assert.equal(await pixels(),paused);
  await page.evaluate(()=>{darkSealStudy.renderAt(1.8);darkSealStudy.renderAt(5);});assert.equal(await pixels(),paused);
  await page.locator('[data-speed="1.5"]').click();await page.locator('#replay').click();assert.equal(await page.evaluate(()=>darkSealStudy.time),0);await page.evaluate(()=>advance(250));assert.ok(Math.abs(await page.evaluate(()=>darkSealStudy.time)-.3)<1e-8);
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const before=await page.evaluate(()=>darkSealStudy.time);await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>darkSealStudy.time),before);await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
  await page.evaluate(()=>darkSealStudy.renderAt(2.7));const original=await pixels();
  await page.evaluate(()=>{window.ext=darkSealStudy.renderer.gl.getExtension('WEBGL_lose_context');ext.loseContext();});await page.waitForFunction(()=>darkSealStudy.renderer.lost,null,{polling:100});
  await page.evaluate(()=>ext.restoreContext());await page.waitForFunction(()=>!darkSealStudy.renderer.lost&&!darkSealStudy.getState().waiting,null,{polling:100});assert.equal(await pixels(),original);
  for(const [width,height] of [[320,568],[844,390],[1440,900]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>{darkSealStudy.resize();darkSealStudy.renderAt(2.7);});
   assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const id of ['pause','replay']){const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1);}
   await page.screenshot({path:path.resolve(`artifacts/dark-seal-${width}x${height}.png`)});
  }
  const sheet=createCanvas(390*4,844),c=sheet.getContext('2d');for(let i=0;i<files.length;i++)c.drawImage(await loadImage(files[i]),i*390,0);fs.writeFileSync('artifacts/dark-seal-contact.png',sheet.toBuffer('image/png'));
  assert.deepEqual(errors,[]);await page.evaluate(()=>darkSealStudy.dispose());assert.equal(await page.evaluate(()=>darkSealStudy.renderer.gl),null);
  console.log('PASS dark SS real generated texture, file loading, phases, pause/replay/speed, hidden-page clocks, GL recovery, mobile/desktop layouts and disposal.',asset);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
