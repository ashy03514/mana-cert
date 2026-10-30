/* Actual formal SS endpoint with live material and rank glints. */
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map();
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const run=[...callbacks.values()];callbacks.clear();run.forEach(fn=>fn(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(settings){
        // Feed the ordinary outcome generator a reproducible sample; never
        // replace an already selected result or bypass the settings weights.
        const result=begin.call(this,settings,()=>.999999);window.originalOutcome=result;window.observedSession=this;return result;
      };
      const draw=FireRankSparkles.draw;
      FireRankSparkles.draw=function(ctx,w,h,options){window.rankStars={options,frames:this.frames(w,h,options)};return draw.call(this,ctx,w,h,options);};
      const embers=FireRankEmbers.draw;
      FireRankEmbers.draw=function(ctx,w,h,options){window.rankEmbers={options,frames:this.frames(w,h,options)};return embers.call(this,ctx,w,h,options);};
    });
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_fire').check({force:true});
    await page.locator('#s_muggle').uncheck({force:true});
    await page.locator('#tab_probabilities').click({force:true});
    await page.locator('#chance_SS').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#btnStart').click({force:true});await page.evaluate(()=>advance(0));
    await page.mouse.move(110,310);await page.mouse.down();await page.mouse.move(275,410,{steps:10});await page.mouse.up();
    await page.evaluate(()=>advance(10800));
    assert.equal(await page.locator('#fireScanValue').textContent(),'9999');
    assert.equal(await page.locator('#fireScanRank').textContent(),'SS');
    assert.equal(await page.locator('#fireScanLabel').textContent(),'魔力值');
    assert.ok(await page.evaluate(()=>Object.isFrozen(originalOutcome)&&originalOutcome===observedSession.currentResult));
    const stars=await page.evaluate(()=>rankStars);assert.equal(stars.options.mana,9999);assert.ok(stars.frames.length>8);
    const embers=await page.evaluate(()=>rankEmbers);assert.equal(embers.options.mana,9999);assert.ok(embers.frames.length>35,'SS emits a substantial independent ember layer');
    await page.screenshot({path:path.resolve(__dirname,'../artifacts/fire-ss-inferno-formal.png'),timeout:60000});
    const canvas=()=>page.locator('#particleCanvas').evaluate(c=>c.toDataURL());
    const before=await canvas();await page.evaluate(()=>advance(350));assert.notEqual(await canvas(),before,'the endpoint keeps burning and twinkling');
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const paused=await canvas();
    await page.evaluate(()=>advance(3000));assert.equal(await canvas(),paused,'background suspension freezes both material and glints');
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await page.evaluate(()=>advance(50));
    for(const [width,height,name] of [[320,568,'small'],[844,390,'landscape']]){
      await page.setViewportSize({width,height});await page.evaluate(()=>dispatchEvent(new Event('resize')));
      const glints=await page.evaluate(()=>rankStars.frames),label=await page.locator('#fireScanLabel').boundingBox();
      assert.ok(glints.length>8);
      if(width<height)assert.ok(glints.every(f=>f.y+f.radius*1.65<label.y-20),'SS star glows clear the readout');
      else assert.ok(glints.every(f=>f.x+f.radius*1.65<label.x),'landscape stars stay in the fire column');
      await page.screenshot({path:path.resolve(__dirname,'../artifacts/fire-rounded-formal-SS-'+name+'.png'),timeout:60000});
    }
    await page.locator('#effectPreviewBack').click({force:true});assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('Formal SS browser passed: real settings/outcome, 9999 readout, live glints, background suspension, 3 layouts and return.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
