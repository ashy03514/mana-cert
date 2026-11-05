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
 let page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(url);
 const click=id=>page.locator('#'+id).click({force:true});
 const checked=(id,value)=>page.locator('#'+id).setChecked(value,{force:true});
 const advance=async ms=>{for(let n=0;n<ms;n+=500)await page.evaluate(n=>advance(n),Math.min(500,ms-n));};
 const slide=(id,value)=>page.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 assert.equal(await page.locator('#s_lightning').isChecked(),true);
 await checked('s_master',false);assert.equal(await page.locator('#s_lightning').isChecked(),false);assert.equal(await page.locator('#btnStart').isDisabled(),true);
 await checked('s_lightning',true);assert.equal(await page.locator('#btnStart').isDisabled(),false);
 await click('tab_probabilities');assert.equal(await page.locator('#chance_E').isDisabled(),false);assert.equal(await page.locator('#rareChance_A').isDisabled(),true);
 await slide('chance_SS',100);
 await page.reload();assert.equal(await page.locator('#s_lightning').isChecked(),true);assert.equal(await page.locator('#s_fire').isChecked(),false);
 await page.close();page=await context.newPage();await page.goto(url);assert.equal(await page.locator('#s_lightning').isChecked(),true);assert.equal(await page.locator('#chance_SS').inputValue(),'100');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();assert.equal(await page.locator('#s_lightning').isChecked(),true);assert.equal(await page.locator('#chance_SS').inputValue(),'100');await context.setOffline(false);
 await page.evaluate(()=>{
  window.qa={begins:0,frames:0,states:[],draws:0,history:[]};
  const begin=ManaResults.Session.prototype.begin;
  ManaResults.Session.prototype.begin=function(...args){const result=begin.apply(this,args);qa.begins++;qa.session=this;qa.original=result;qa.history=[];return result;};
  const step=RevealFlow.prototype.step;RevealFlow.prototype.step=function(...args){qa.flow=this;return step.apply(this,args);};
  const draw=LightningStormRenderer.prototype.draw;LightningStormRenderer.prototype.draw=function(...args){qa.renderer=this;qa.frame=args[4];qa.draws++;if(args[4]?.lightningEffects)qa.history.push(args[4].lightningEffects);return draw.apply(this,args);};
  const transition=ManaResults.Session.prototype.transition;ManaResults.Session.prototype.transition=function(...args){const r=transition.apply(this,args);qa.states.push(this.state);return r;};
 });
 for(const rank of ['E','D','C','B','A','S','SS']){
  await click('tab_probabilities');await slide('chance_'+rank,100);await click('btnStart');await advance(50);
  const start=await page.evaluate(()=>({result:qa.session.currentResult,begins:qa.begins}));
  assert.equal(start.result.element,'雷');assert.equal(start.result.rank,rank);
  assert.equal(await page.locator('#materialControls').isVisible(),false);assert.equal(await page.locator('#effectPreviewBack').isVisible(),false);
  await page.mouse.move(150,320);await page.mouse.down();
  if(rank==='A'){await advance(3200);await page.mouse.up();}
  else{await page.mouse.move(250,430,{steps:8});await page.mouse.up();}
  await advance(11000);
  const end=await page.evaluate(()=>({result:qa.session.currentResult,same:qa.original===qa.session.currentResult,frozen:Object.isFrozen(qa.original),begins:qa.begins,state:qa.session.state,flow:qa.flow.state,draws:qa.draws,time:qa.frame?.time,box:qa.frame?.box}));
  const history=await page.evaluate(()=>qa.history),expected=await page.evaluate(rank=>LightningRankEffects.forRank(rank),rank);
  assert.equal(history.at(-1).profile.rank,rank);
  for(const key of Object.keys(expected).filter(k=>k!=='rank'))assert.ok(Math.abs(history.at(-1).profile[key]-expected[key])<1e-8,rank+' settles to '+key);
  assert.ok(history.every((p,i)=>i===0||p.time>=history[i-1].time),'motion clock never goes backward');
  if(rank==='E'||rank==='D')assert.ok(history.every(p=>p.profile.skyStrength===0),'lower ranks never strike from sky');
  if(rank==='SS')for(const r of ['E','D','C','B','A','S','SS'])assert.ok(history.some(p=>p.profile.rank===r),'SS climb passes '+r);
  assert.equal(end.same,true);assert.equal(end.frozen,true);assert.equal(end.begins,start.begins);assert.equal(end.state,'MANA_SCAN');assert.equal(end.flow,'REVEAL');assert.ok(end.draws>10);
  assert.equal(await page.locator('#fireScanValue').textContent(),String(end.result.mana).padStart(3,'0'));
  assert.equal(await page.locator('#fireScanRank').textContent(),rank);assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'lightning');
  assert.equal(await page.locator('#materialError').isVisible(),false);assert.equal(await page.locator('#formalReplay').isVisible(),true);
  const title=await page.locator('#revealTitle').boundingBox(),value=await page.locator('#fireScanValue').boundingBox(),grade=await page.locator('#fireScanRank').boundingBox(),button=await page.locator('#formalReplay').boundingBox();
  assert.ok(title.y+title.height<value.y);assert.ok(value.y+value.height<grade.y);assert.ok(grade.y+grade.height<button.y);
  const bottom=await page.evaluate(()=>ResultLayout.bounds(qa.frame.box,'lightning').bottom);assert.ok(bottom<title.y);
  await page.screenshot({path:path.join(output,'lightning-'+rank+'.png')});
  if(rank==='SS'){
   const first=await page.locator('#particleCanvas').evaluate(c=>c.toDataURL());await advance(500);assert.notEqual(await page.locator('#particleCanvas').evaluate(c=>c.toDataURL()),first);
   await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const stopped=await page.locator('#particleCanvas').evaluate(c=>c.toDataURL());await advance(1500);assert.equal(await page.locator('#particleCanvas').evaluate(c=>c.toDataURL()),stopped);
   await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(100);
  }
  console.log('PASS formal '+rank+' '+end.result.mana+' '+(rank==='A'?'hold':'draw')+' immutable outcome and layout');
  await click('formalReplay');assert.equal(await page.locator('#btnGoHome').isVisible(),true);await click('btnGoHome');assert.equal(await page.locator('#settingsPage').isVisible(),true);
 }
 await click('tab_switches');await checked('s_lightning',false);await page.reload();assert.equal(await page.locator('#s_lightning').isChecked(),false);assert.equal(await page.locator('#btnStart').isDisabled(),true);
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem(CertSettings.key));delete data.settings.elements.雷;data.settings.elements.風=true;localStorage.setItem(CertSettings.key,JSON.stringify(data));});await page.reload();assert.equal(await page.locator('#s_lightning').isChecked(),false);assert.equal(await page.locator('#s_wind').isChecked(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log(JSON.stringify({output,errors,failures,settings:'reload/reopen/offline/master/migration passed',formal:'E/D/C/B/A/S/SS growth passed'}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
