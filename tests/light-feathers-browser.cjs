'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...a){window.flowTest=this;return reset.apply(this,a);};
      const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(...a){window.sessionTest=this;window.resultTest=begin.apply(this,a);return resultTest;};
      const original=LightAngelLayeredGrowthRenderer;window.LightAngelLayeredGrowthRenderer=class extends original{constructor(){super();window.rendererTest=this;}};
      const feathers=LightFeathers;window.LightFeathers={...feathers,get loaded(){return !window.forceFeatherLoading&&feathers.loaded;},get error(){return feathers.error;},draw(ctx,args){window.featherArgs=args;window.featherFrames=feathers.draw(ctx,args);return featherFrames;}};
      Math.random=()=>.1;
    });
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_light').check({force:true});await page.locator('#tab_probabilities').click();
    await page.locator('#rareChance_SS').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#btnStart').click();await page.waitForFunction(()=>rendererTest.loaded&&LightFeathers.loaded,null,{polling:100});
    assert.equal(await page.evaluate(()=>resultTest.rank),'SS');
    await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(240,365,{steps:8});await page.mouse.up();
    for(let i=0;i<100;i++){await page.evaluate(()=>advance(50));if(await page.evaluate(()=>flowTest.state==='AWAKEN'))break;}
    assert.equal(await page.evaluate(()=>flowTest.state),'AWAKEN');
    await page.evaluate(()=>window.forceFeatherLoading=true);const loadingTime=await page.evaluate(()=>flowTest.elapsed);
    await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>flowTest.elapsed),loadingTime,'asset loading cannot consume the release');
    assert.equal(await page.locator('#materialError').isVisible(),true);
    await page.evaluate(()=>{window.forceFeatherLoading=false;advance(0);});
    assert.equal(await page.evaluate(()=>featherFrames.length),0,'no feathers before release');
    await page.evaluate(()=>{flowTest.paused=true;flowTest.elapsed=1.88;advance(0);});
    assert.equal(await page.evaluate(()=>featherFrames.length),10);
    assert.ok(await page.evaluate(()=>featherFrames.every(f=>f.alpha<=.5&&f.brightness===1.25)));
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-feathers-awakening-v112.png')});
    // No teleport or loss at either stage boundary: sample the live host clock.
    for(const [from,end,to] of [['AWAKEN',1.9,'FORM'],['FORM',.6,'REVEAL']]){
      await page.evaluate(({from,end})=>{flowTest.state=from;flowTest.elapsed=end-.001;advance(0);},{from,end});
      const before=await page.evaluate(()=>featherFrames);
      if(from==='FORM')assert.ok(before.some(f=>f.burstKind==='A'),'initial A feathers already shed before formation ends');
      await page.evaluate(to=>{flowTest.state=to;flowTest.elapsed=.001;advance(0);},to);
      const after=await page.evaluate(()=>featherFrames);
      for(const f of before){const next=after.find(n=>n.id===f.id);assert.ok(next,'existing flight survives '+from);assert.ok(Math.hypot(next.x-f.x,next.y-f.y)<3,'continuous boundary flight');}
    }
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-feathers-near-v112.png')});
    const stages=await page.evaluate(()=>LightRankGrowth.timeline(resultTest));
    for(const event of stages){
      await page.evaluate(elapsed=>{flowTest.state='REVEAL';flowTest.elapsed=elapsed;advance(0);},event.at-.001);
      assert.equal(await page.evaluate(kind=>featherFrames.some(f=>f.burstKind===kind),event.to),false,'no premature '+event.to+' shedding');
      await page.evaluate(elapsed=>{flowTest.elapsed=elapsed;advance(0);},event.at+event.duration*.65);
      const during=await page.evaluate(kind=>({frames:featherFrames.filter(f=>f.burstKind===kind),burst:featherArgs.bursts.find(b=>b.kind===kind),
        base:flowTest.awakeningDuration+flowTest.formationDuration}),event.to);
      assert.ok(during.frames.length>0&&during.frames.length<{S:10,SS:13}[event.to],'feathers appear during '+event.from+'→'+event.to+' formation');
      assert.ok(Math.abs(during.burst.at-(during.base+event.at))<1e-9,'release begins with the actual growth event');
      assert.ok(during.burst.births.every(b=>b.delay>0&&b.delay<event.duration),'no extra completion-time emission');
      assert.ok(during.burst.births.every(b=>b.sourceAlpha>.5),'birth points lie on the generated target wing texture');
      assert.ok(during.burst.births.some(b=>b.side<0)&&during.burst.births.some(b=>b.side>0));
      assert.ok(during.burst.births.every(b=>Math.abs(b.x-during.burst.x)>8),'wing shedding does not originate from the central core');
      assert.ok(await page.evaluate(()=>rendererTest.layerState.progress<1),'captured silhouette is still forming');
      await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-feathers-'+event.from+'-'+event.to+'-shedding-v112.png')});
      await page.evaluate(elapsed=>{flowTest.elapsed=elapsed;advance(0);},event.formedAt+.7);
      const after=await page.evaluate(kind=>featherFrames.filter(f=>f.burstKind===kind),event.to);
      assert.equal(after.length,{S:10,SS:13}[event.to]);
      for(const f of during.frames){const next=after.find(n=>n.id===f.id);assert.ok(next);assert.equal(next.originX,f.originX);assert.equal(next.originY,f.originY);assert.equal(next.detachedAt,f.detachedAt);}
    }
    for(const [kind,elapsed] of [['A',.7],...stages.map(e=>[e.to,e.formedAt+.7])]){
      await page.evaluate(elapsed=>{flowTest.state='REVEAL';flowTest.elapsed=elapsed;advance(0);},elapsed);
      assert.ok(await page.evaluate(kind=>featherFrames.some(f=>f.burstKind===kind),kind),'birth/evolution emits '+kind);
      const released=await page.evaluate(kind=>featherFrames.filter(f=>f.burstKind===kind),kind);
      assert.equal(released.length,{A:7,S:10,SS:13}[kind]);
      assert.ok(await page.evaluate(()=>featherFrames.every(f=>f.alpha<=.5&&f.brightness===1.25)),'new and lingering feathers share the quieter style');
      assert.ok(await page.evaluate(()=>sessionTest.currentResult===resultTest&&Object.isFrozen(resultTest)));
      await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-feathers-'+kind+'-v112.png')});
      const snapshot=await page.evaluate(()=>JSON.stringify(featherFrames));await page.evaluate(()=>advance(250));assert.equal(await page.evaluate(()=>JSON.stringify(featherFrames)),snapshot,'pause exact');
    }
    await page.evaluate(()=>{flowTest.elapsed=20;advance(0);});assert.equal(await page.evaluate(()=>featherFrames.length),0,'idle wing cycles do not re-emit');
    await page.locator('#effectPreviewBack').click();await page.locator('#tab_effects').click();
    await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#materialPreviewOpen').click();await page.locator('#material_light').click();
    await page.waitForFunction(()=>rendererTest.loaded,null,{polling:100});await page.evaluate(()=>advance(1400));
    assert.ok(await page.evaluate(()=>featherFrames.length>0),'direct preview appearance also emits');
    await page.locator('#materialPause').click();const fixed=await page.evaluate(()=>JSON.stringify(featherFrames));await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>JSON.stringify(featherFrames)),fixed);
    await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>featherFrames.length),0,'replay clears previous flight');
    assert.deepEqual(errors,[]);console.log('PASS light feathers browser: generated sprite on file URL, loading gate, wing-surface shedding during A/S/SS formation, continuous handoff, fixed outcomes/birth locations, pause/replay, no idle repeats, direct preview.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
