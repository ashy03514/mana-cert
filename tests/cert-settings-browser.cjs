const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),prefix='/mana-cert-main/';
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream');res.end(bytes);});
});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mana-settings-'));
const options={headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']};
let url;
let context;
const errors=[];
async function pageAt(url){const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);return p;}
const snapshot=p=>p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#panel_switches input,#panel_probabilities input')].map(e=>[e.id,{value:e.type==='checkbox'?e.checked:e.value,disabled:e.disabled}])));
const slide=(p,id,v)=>p.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);
(async()=>{try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+prefix+'index.html?v=123';
 context=await chromium.launchPersistentContext(profile,options);let page=await pageAt(url);
 await page.locator('#tab_probabilities').click();await slide(page,'chance_S',67);await slide(page,'rareChance_SS',100);await slide(page,'muggleChance',23);
 await page.locator('#tab_switches').click();for(const id of ['s_fire','s_light','s_dark','s_muggle','soundEnabled','hapticsEnabled'])await page.locator('#'+id).uncheck({force:true});
 const expected=await snapshot(page),saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(CertSettings.key)).settings);
 assert.equal(saved.normalRanks.S,67);assert.equal(saved.rareElementRanks.SS,100);assert.equal(saved.mugglePercent,23);assert.equal(saved.soundEnabled,false);
 await page.reload();assert.deepEqual(await snapshot(page),expected,'F5 keeps every switch, value and disabled group');
 await page.close();page=await pageAt(url);assert.deepEqual(await snapshot(page),expected,'closing/reopening page preserves values');
 await context.close();context=await chromium.launchPersistentContext(profile,options);page=await pageAt(url);assert.deepEqual(await snapshot(page),expected,'full browser restart retains saved preferences');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.equal(await page.evaluate(async()=>!!await (await caches.open('mana-pwa-v3-portal-123')).match('./js/cert-settings.js')),true,'new storage module cached within project subdirectory');
 await context.setOffline(true);await page.reload();assert.deepEqual(await snapshot(page),expected,'offline PWA reload retains settings');await context.setOffline(false);
 await page.locator('#s_master').check({force:true});await page.locator('#s_master').uncheck({force:true});await page.reload();assert.equal(await page.locator('#s_master').isChecked(),false);assert.equal(await page.locator('#btnStart').isDisabled(),true);
 await page.locator('#s_master').check({force:true});await page.locator('#tab_probabilities').click();assert.equal(await page.locator('#rareChance_SS').inputValue(),'100','disabled probabilities were retained');
 await page.locator('#restoreProbabilities').click();await page.reload();assert.equal(await page.locator('#rareChance_A').inputValue(),'60');assert.equal(await page.locator('#muggleChance').inputValue(),'8');
 await page.evaluate(()=>localStorage.setItem(CertSettings.key,'{broken'));await page.reload();assert.equal(await page.locator('#s_master').isChecked(),true);assert.equal(await page.locator('#chance_S').inputValue(),'10');
 await page.evaluate(()=>localStorage.setItem(CertSettings.key,JSON.stringify({version:1,settings:{elements:{火:false},normalRanks:{S:999},rareElementRanks:{A:-1},mugglePercent:500}})));await page.reload();assert.equal(await page.locator('#s_fire').isChecked(),false);assert.equal(await page.locator('#chance_S').inputValue(),'10');assert.equal(await page.locator('#muggleChance').inputValue(),'8');
 const file=await pageAt(pathToFileURL(path.resolve('index.html')).href);await file.locator('label:has(#s_water)').click();await file.reload();assert.equal(await file.locator('#s_water').isChecked(),false,'local file preferences persist too');
 const blocked=await context.newPage();blocked.on('pageerror',e=>errors.push(String(e)));await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));await blocked.goto(url);await blocked.locator('label:has(#s_fire)').click();assert.equal(await blocked.locator('#s_fire').isChecked(),false);
 assert.deepEqual(errors,[]);console.log('PASS immediate save; reload, reopened page and full browser restart; disabled groups, master, sound/haptics, reset, corrupt data fallback, file:// and unavailable storage.');
}finally{await context?.close();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
