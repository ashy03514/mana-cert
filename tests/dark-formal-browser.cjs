/* Actual drawing-to-result host, with committed A/S/SS outcomes and sampled
 * GPU frames at meaningful endpoints. Shader time never selects a result. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   // Repeated pixel reads otherwise make Chrome change Canvas2D backend mid-
   // test. Keep exact pixel comparisons while production retains acceleration.
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,options){return getContext.call(this,type,type==='2d'?{...options,willReadFrequently:true}:options);};
   let now=0,id=0;const pending=new Map();Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
   requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);
   window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...pending.values()];pending.clear();run.forEach(fn=>fn(now));}while(ms>0);};
  });
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(()=>{
   const Original=DarkDemonWingGrowthRenderer;window.darkHistory=[];window.darkReadouts=[];window.realDarkPaint=false;
   window.DarkDemonWingGrowthRenderer=class extends Original{
    constructor(...args){super(...args);window.formalDark=this;}
    draw(...args){this.hostArgs=args;const frame=args[3];if(Number.isFinite(frame.growth))darkHistory.push({growth:frame.growth,time:frame.motionTime,rank:frame.rank});
     darkReadouts.push(document.getElementById('fireScanRank').textContent);
     return realDarkPaint?super.draw(...args):!this.error&&!this.lost;}
   };
   const oldDraw=ElementMaterialRenderer.prototype.draw;window.legacyDarkDraws=0;
   ElementMaterialRenderer.prototype.draw=function(...args){if(this.element==='dark')legacyDarkDraws++;return oldDraw.apply(this,args);};
   const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.darkFlow=this;return reset.apply(this,args);};
   const begin=ManaResults.Session.prototype.begin;window.beginCalls=0;window.targetDark={rank:'A',mana:750};
   ManaResults.Session.prototype.begin=function(settings){
    beginCalls++;darkHistory.length=0;darkReadouts.length=0;
    const {rank,mana}=targetDark,[min,max]=ManaConfig.ranks[rank].range,draws=[.25,.5,(mana-min+.25)/(max-min+1)];let i=0;
    const result=begin.call(this,{...settings,rareElementRanks:{A:0,S:0,SS:0,[rank]:100}},()=>draws[i++]??.5);
    window.originalDarkResult=result;window.darkSession=this;return result;
   };
   window.renderFormalDark=()=>{
    const r=formalDark,ok=Original.prototype.draw.apply(r,r.hostArgs),ctx=r.hostArgs[0],c=ctx.canvas;
    const data=ctx.getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619)>>>0;
    return {ok,error:r.error,gl:r.gl?.getError(),hash,layer:r.layerState,args:r.hostArgs[3],finite:r.meshes.length===2&&r.meshes.every(m=>Array.from(m.vertices).every(Number.isFinite))};
   };
  });
  const click=id=>require('./result-action-helpers.cjs')(page,'#'+id),advance=ms=>page.evaluate(ms=>window.advance(ms),ms),render=()=>page.evaluate(()=>renderFormalDark());
  await click('tab_switches');await page.locator('#s_master').uncheck({force:true});await page.locator('#s_dark').check({force:true});await page.locator('#s_muggle').uncheck({force:true});
  for(const target of [{rank:'A',mana:750},{rank:'S',mana:900},{rank:'S',mana:998},{rank:'SS',mana:999}]){
   await page.evaluate(target=>{targetDark=target;realDarkPaint=false;},target);await click('btnStart');
   await page.waitForFunction(()=>window.formalDark?.loaded||window.formalDark?.error,null,{polling:100});await advance(0);
   assert.equal(await page.evaluate(()=>formalDark.error),'');
   assert.deepEqual(await page.evaluate(()=>({rank:originalDarkResult.rank,mana:originalDarkResult.mana,element:originalDarkResult.element})),{...target,element:'暗'});
   assert.deepEqual(await page.evaluate(()=>Object.keys(formalDark.images).sort()),['A','S','SS']);
   assert.equal(await page.locator('#materialControls').isVisible(),false,'formal has no debug controls');
   await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(270,385,{steps:6});await page.mouse.up();
   for(let i=0;i<160;i++){await advance(50);if(await page.evaluate(()=>darkFlow.state==='REVEAL'))break;}
   assert.equal(await page.evaluate(()=>darkFlow.state),'REVEAL');
   const initial=await render();assert.equal(initial.ok,true);assert.equal(initial.error,'');assert.equal(initial.gl,0);assert.ok(initial.args.growth<.001,'all outcomes begin with A wings');
   await advance(1100);assert.equal(await page.locator('#fireScanReadout').isVisible(),true);assert.equal(await page.locator('#fireScanReadout').getAttribute('data-element'),'dark');
   await advance(5100);const final=await render();
   assert.equal(final.ok,true);assert.equal(final.error,'');assert.equal(final.gl,0);assert.equal(final.finite,true);
   assert.equal(final.args.growth,{A:0,S:1,SS:2}[target.rank]);assert.equal(final.layer.to,target.rank);assert.equal(final.layer.progress,1);assert.equal(final.layer.exposure,0);
   assert.equal(await page.locator('#fireScanValue').textContent(),String(target.mana));assert.equal(await page.locator('#fireScanRank').textContent(),target.rank);
   assert.equal(await page.locator('#formalReplay').isVisible(),true);
   const history=await page.evaluate(()=>({same:darkSession.currentResult===originalDarkResult,frozen:Object.isFrozen(originalDarkResult),legacy:legacyDarkDraws,frames:darkHistory,readouts:darkReadouts}));
   assert.equal(history.same,true);assert.equal(history.frozen,true);assert.equal(history.legacy,0);
   assert.ok(history.readouts.every(rank=>['—','A','S','SS'].includes(rank)),'rare attribute never shows E through B');
   assert.ok(history.frames.every((f,i,a)=>Number.isFinite(f.time)&&(!i||f.time>=a[i-1].time)),'material clock never rewinds');
   assert.ok(history.frames.every((f,i,a)=>!i||(f.growth>=a[i-1].growth&&f.growth-a[i-1].growth<.2)),'growth moves continuously toward destination');
   await page.evaluate(()=>realDarkPaint=true);await advance(0);await page.screenshot({path:path.join(root,`artifacts/dark-formal-${target.rank}-${target.mana}.png`)});await page.evaluate(()=>realDarkPaint=false);
   const before=await render();await advance(500);const after=await render();assert.notEqual(after.hash,before.hash,'settled wing animation continues');
   await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const held=await page.evaluate(()=>darkFlow.elapsed);await advance(500);assert.equal(await page.evaluate(()=>darkFlow.elapsed),held);await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(100);
   if(target.mana===999){
    await page.evaluate(()=>{darkFlow.paused=true;window.savedDarkElapsed=darkFlow.elapsed;});
    const events=await page.evaluate(()=>DarkRankGrowth.timeline(originalDarkResult));assert.deepEqual(events.map(e=>[e.from,e.to]),[['A','S'],['S','SS']]);
    for(const event of events){
     for(const [name,elapsed,exposure]of [['forming',event.at+event.duration*.5,1],['bright',event.formedAt,1],['settled',event.completeAt,0]]){
      await page.evaluate(elapsed=>{darkFlow.elapsed=elapsed;},elapsed);await advance(0);const pose=await render();
      assert.equal(pose.layer.from,event.from);assert.equal(pose.layer.to,event.to);assert.ok(Math.abs(pose.layer.exposure-exposure)<1e-8);
      if(name!=='forming')assert.equal(pose.layer.progress,1);assert.equal(pose.gl,0);assert.equal(pose.finite,true);
      await page.evaluate(()=>realDarkPaint=true);await advance(0);await page.screenshot({path:path.join(root,`artifacts/dark-formal-${event.from}-${event.to}-${name}.png`)});await page.evaluate(()=>realDarkPaint=false);
     }
    }
    await page.evaluate(()=>{darkFlow.elapsed=FireScanTransition.timing.complete;});await advance(0);assert.equal(await page.locator('#fireScanValue').textContent(),'999');assert.equal(await page.locator('#formalReplay').isVisible(),false,'numeric endpoint waits for the final full wing and exposure settle');
    await page.evaluate(()=>{darkFlow.elapsed=DarkRankGrowth.sample(10,originalDarkResult).completeAt+.1;});await advance(0);assert.equal(await page.locator('#formalReplay').isVisible(),true);
    await page.evaluate(()=>{const e=DarkRankGrowth.timeline(originalDarkResult)[1];darkFlow.elapsed=e.at+e.duration*.5;});await advance(0);const beforeRecovery=await render();
    await page.evaluate(()=>{window.darkLoss=formalDark.gl.getExtension('WEBGL_lose_context');darkLoss.loseContext();});await page.waitForFunction(()=>formalDark.lost,null,{polling:100});
    const stopped=await page.evaluate(()=>darkFlow.elapsed);await advance(500);assert.equal(await page.evaluate(()=>darkFlow.elapsed),stopped);
    await page.evaluate(()=>darkLoss.restoreContext());await page.waitForFunction(()=>!formalDark.lost&&!!formalDark.program,null,{polling:100});await advance(0);
    const afterRecovery=await render();assert.equal(afterRecovery.gl,0);assert.equal(afterRecovery.hash,beforeRecovery.hash,'mid-growth context restoration reproduces the same frame');
    await page.evaluate(()=>{darkFlow.elapsed=savedDarkElapsed;realDarkPaint=true;});await advance(0);
    for(const [width,height]of [[320,568],[844,390],[390,844]]){
     await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));await advance(0);
     const boxes=[];for(const id of ['revealTitle','fireScanLabel','fireScanValue','fireScanRank','formalReplay']){
      const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`${id} visible at ${width}x${height}`);boxes.push(b);
     }
     for(let i=0;i<4;i++)assert.ok(boxes[i].y+boxes[i].height<boxes[i+1].y,'readout rows clear each other and replay');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(root,`artifacts/dark-formal-SS-${width}x${height}.png`)});
    }
    await page.evaluate(()=>{window.oldDark=formalDark;realDarkPaint=false;});const begins=await page.evaluate(()=>beginCalls);await click('formalReplay');assert.equal(await page.evaluate(()=>beginCalls),begins+1);assert.equal(await page.evaluate(()=>oldDark.disposed),true);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
   }
   await click('effectPreviewBack');assert.equal(await page.evaluate(()=>formalDark.disposed),true);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
   console.log(`Formal dark ${target.rank} ${target.mana} passed.`);
  }
  assert.deepEqual(errors,[]);console.log('PASS formal dark: immutable A/S/SS results, actual stroke flow, registered wing evolution/exposure, continued idle, layouts, hide/resume, context recovery and retry/disposal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
