'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stage=process.env.MANA_TEST_ROOT||path.resolve(__dirname,'..'),canonical=process.env.MANA_TEST_FALLBACK||stage;
const output=fs.mkdtempSync(path.join(os.tmpdir(),'mana-v161-browser-'));
const prefix='/mana-cert/';
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const relative=pathname.slice(prefix.length)||'index.html';
 if(relative.includes('..')){res.writeHead(403);res.end();return;}
 const candidate=path.join(stage,relative),file=fs.existsSync(candidate)?candidate:path.join(canonical,relative);
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+prefix+'index.html';
 const browser=await chromium.launch({headless:true,executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const errors=[],failures=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)failures.push(r.url());});});
 await context.addInitScript(()=>{
  let now=0,id=0;const callbacks=new Map();
  Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);
  window.advance=ms=>{do{const step=Math.min(ms,50);ms-=step;now+=step;const run=[...callbacks.values()];callbacks.clear();for(const fn of run)fn(now);}while(ms>0);};
 });

 const page=await context.newPage();await page.goto(url);
 const click=id=>page.locator('#'+id).click({force:true});
 const advance=async ms=>{for(let n=0;n<ms;n+=500)await page.evaluate(n=>advance(n),Math.min(500,ms-n));};
 await page.evaluate(()=>{
  const draw=LightningStormRenderer.prototype.draw;
  LightningStormRenderer.prototype.draw=function(...args){window.lastLightning=args[4];return draw.apply(this,args);};
 });
 await click('tab_effects');await page.locator('details').filter({has:page.locator('#materialPreviewOpen')}).locator('summary').click();
 await click('materialPreviewOpen');await click('material_lightning');
 assert.equal(await page.locator('#materialLightningRanks').isVisible(),true);
 for(const rank of ['E','D','C','B','A','S','SS']){
  await click('lightningRank_'+rank);await advance(500);
  assert.equal(await page.locator('#lightningRank_'+rank).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>lastLightning.lightningEffects.profile.rank),rank);
  assert.ok((await page.locator('#materialHeadingTitle').textContent()).includes(rank));
 }
 await click('materialPause');const still=await page.locator('#particleCanvas').evaluate(c=>c.toDataURL());await advance(500);
 assert.equal(await page.locator('#particleCanvas').evaluate(c=>c.toDataURL()),still);
 await click('materialReplay');assert.ok(await page.evaluate(()=>lastLightning.time<.01));
 await click('material_fire');assert.equal(await page.locator('#materialLightningRanks').isVisible(),false);
 await click('material_lightning');assert.equal(await page.locator('#materialLightningRanks').isVisible(),true);
 await page.screenshot({path:path.join(output,'lightning-rank-controls.png')});
 await click('effectPreviewBack');await click('flowPreviewOpen');await click('material_lightning');await click('lightningRank_C');
 await page.mouse.move(140,300);await page.mouse.down();await page.mouse.move(250,400,{steps:6});await page.mouse.up();await advance(6000);
 assert.equal(await page.evaluate(()=>lastLightning.lightningEffects.profile.rank),'C');
 assert.equal(await page.locator('#materialError').isVisible(),false);
 await click('materialPause');const held=await page.locator('#particleCanvas').evaluate(c=>c.toDataURL());await advance(500);assert.equal(await page.locator('#particleCanvas').evaluate(c=>c.toDataURL()),held);
 await page.screenshot({path:path.join(output,'lightning-C-flow.png')});
 await click('materialReplay');await click('lightningRank_E');
 await click('effectPreviewBack');assert.equal(await page.locator('#tab_effects').getAttribute('aria-selected'),'true');
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log(JSON.stringify({output,result:'PASS seven preview selectors, flow C, exact pause, replay and return',errors,failures}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
