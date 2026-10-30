const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  const tab=id=>page.locator('#tab_'+id).click();
  const slide=(id,value)=>page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
  const values=prefix=>page.locator('[id^="'+prefix+'"]').evaluateAll(els=>els.map(el=>Number(el.value)));
  await tab('probabilities');await slide('chance_E',100);await slide('rareChance_SS',100);
  assert.equal(await page.locator('#percent_E').textContent(),'100%');assert.equal(await page.locator('#rarePercent_SS').textContent(),'100%');
  assert.equal((await values('chance_')).reduce((a,b)=>a+b),100);assert.equal((await values('rareChance_')).reduce((a,b)=>a+b),100);
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/probability-groups-v113.png')});
  await tab('switches');await page.locator('#s_light').uncheck({force:true});await page.locator('#s_dark').uncheck({force:true});await tab('probabilities');
  assert.equal(await page.locator('#rareChance_SS').isDisabled(),true);assert.equal(await page.locator('#chance_E').isEnabled(),true);
  await slide('rareChance_A',100);assert.equal(await page.locator('#rarePercent_SS').textContent(),'100%','disabled group retains weights');
  await tab('switches');await page.locator('#s_light').check({force:true});for(const k of ['fire','water','wind','earth'])await page.locator('#s_'+k).uncheck({force:true});await page.locator('#s_muggle').uncheck({force:true});await tab('probabilities');
  assert.equal(await page.locator('#rareChance_SS').isEnabled(),true);assert.equal(await page.locator('#chance_E').isDisabled(),true);assert.equal(await page.locator('#muggleChance').isDisabled(),true);
  await page.evaluate(()=>{const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(settings,...rest){window.selectedSettings=settings;window.selectedResult=begin.call(this,settings,...rest);return selectedResult;};});
  await page.locator('#btnStart').click();assert.equal(await page.evaluate(()=>selectedResult.rank),'SS');assert.equal(await page.evaluate(()=>selectedSettings.normalRanks.E),100);assert.equal(await page.evaluate(()=>selectedSettings.rareElementRanks.SS),100);
  await page.locator('#effectPreviewBack').click();await tab('switches');await page.locator('#s_light').uncheck({force:true});await page.locator('#s_fire').check({force:true});await page.locator('#btnStart').click();assert.equal(await page.evaluate(()=>selectedResult.rank),'E');
  await page.locator('#effectPreviewBack').click();await tab('switches');await page.locator('#s_master').check({force:true});await page.locator('#s_master').uncheck({force:true});await tab('probabilities');
  for(const id of ['chance_E','rareChance_A','muggleChance','restoreProbabilities'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  await tab('switches');await page.locator('#s_master').check({force:true});await tab('probabilities');await page.locator('#restoreProbabilities').click();
  assert.deepEqual(await values('rareChance_'),[60,30,10]);assert.equal(await page.locator('#muggleChance').inputValue(),'8');
  assert.deepEqual(errors,[]);console.log('PASS probability groups: independent totals/outcomes, per-category disabling, retained values, master switch, reset, mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
