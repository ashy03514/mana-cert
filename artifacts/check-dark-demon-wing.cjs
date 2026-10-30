'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve('dark-demon-wing-study.html')).href);
  await page.waitForFunction(()=>darkDemonWingStudy.getState().loaded||darkDemonWingStudy.getState().failed);
  assert.equal(await page.evaluate(()=>darkDemonWingStudy.getState().failed),false);
  assert.deepEqual(await page.evaluate(()=>[darkDemonWingStudy.wing.naturalWidth,darkDemonWingStudy.wing.naturalHeight]),[1536,1024]);
  assert.equal(await page.evaluate(()=>darkDemonWingStudy.wing.src.startsWith('data:')),true);
  const pixels=()=>page.evaluate(()=>document.querySelector('canvas').toDataURL());
  const initial=await pixels();await page.evaluate(()=>darkDemonWingStudy.render());assert.equal(await pixels(),initial);
  await page.locator('#chainsToggle').uncheck();assert.notEqual(await pixels(),initial);
  await page.locator('#chainsToggle').check();assert.equal(await pixels(),initial);
  for(const [width,height] of [[390,844],[320,568],[844,390],[1440,900]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>darkDemonWingStudy.resize());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const id of ['fullView','detailView','chainsToggle']){
    const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`${id} out of ${width}x${height}`);
   }
   await page.screenshot({path:path.resolve(`artifacts/dark-demon-wing-${width}x${height}.png`)});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#detailView').click();
  assert.equal(await page.evaluate(()=>darkDemonWingStudy.getState().zoom),1.65);
  const b=await page.locator('#stage').boundingBox();
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+40,b.y+b.height*.5+30,{steps:3});await page.mouse.up();
  assert.ok(await page.evaluate(()=>darkDemonWingStudy.getState().pan.x>30));
  await page.screenshot({path:path.resolve('artifacts/dark-demon-wing-detail.png')});
  await page.locator('#fullView').click();assert.deepEqual(await page.evaluate(()=>darkDemonWingStudy.getState().pan),{x:0,y:0});
  assert.deepEqual(errors,[]);await page.evaluate(()=>darkDemonWingStudy.dispose());
  assert.equal(await page.evaluate(()=>darkDemonWingStudy.getState().disposed),true);
  console.log('PASS: embedded file:// assets, separate chain toggle, static rendering, four responsive layouts, detail drag/reset, no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
