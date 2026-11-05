'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:435,height:941},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url=process.env.MANA_TEST_URL||pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  await page.goto(url);
  await page.evaluate(()=>localStorage.setItem(WaitingPromptSettings.key,JSON.stringify({version:1,values:{text:'測試等待文字\n第二行',offsetY:430,size:36,letterSpacing:8,lineHeight:1.8,color:'#ff00ff'}})));
  await page.reload();
  const range=page.locator('#waitingPromptPositionY');
  assert.equal(await range.getAttribute('type'),'range');assert.equal(await range.inputValue(),'50','old pixel setting migrates to center');
  const edit=(id,value)=>page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  for(const position of [0,50,100]){
   await edit('waitingPromptPositionY',position);await page.reload();
   assert.equal(await range.inputValue(),String(position),'saved position survives reload');
   await page.locator('#btnStart').click();
   const box=await page.locator('#waitingPrompt').boundingBox();
   assert.ok(Math.abs(box.x+box.width/2-217.5)<1,'horizontally centered');
   if(position===0)assert.ok(Math.abs(box.y-18)<1,'top endpoint keeps text inside screen');
   if(position===50)assert.ok(Math.abs(box.y+box.height/2-470.5)<1,'center is text center');
   if(position===100)assert.ok(Math.abs(box.y+box.height-923)<1,'bottom endpoint keeps multiline text inside screen');
   assert.equal(await page.locator('#waitingPrompt').evaluate(e=>getComputedStyle(e).fontSize),'36px');
   if(position===50)await page.screenshot({path:path.join(os.tmpdir(),'mana-v164-waiting.png')});
   await page.mouse.move(218,500);await page.mouse.down();await page.waitForTimeout(400);
   const status=await page.locator('#interactionPrompt').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.querySelector('[data-prompt-current]');return {y:r.y,center:r.x+r.width/2,size:s.fontSize,spacing:s.letterSpacing,color:getComputedStyle(p).color,text:p.textContent,previous:e.querySelector('[data-prompt-previous]').textContent};});
   assert.equal(status.y,92);assert.equal(status.center,217.5);
   assert.equal(status.size,'22px');assert.equal(status.spacing,'2px');assert.equal(status.color,'rgb(238, 247, 255)');
   assert.equal(status.text,'感應到魔力波動');assert.equal(status.previous,'','guide does not jump to the status location');
   if(position===100)await page.screenshot({path:path.join(os.tmpdir(),'mana-v164-status.png')});
   await page.mouse.up();await page.goto(url);
  }
  assert.deepEqual(errors,[]);console.log('PASS slider top/center/bottom, multiline bounds, legacy preference migration, persistence and fully independent system prompt.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
