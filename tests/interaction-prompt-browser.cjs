/* Production gesture loop and DOM status. Phone/PWA visual acceptance is separate. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MANA_PLAYWRIGHT_MODULE||'C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.MANA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:435,height:941},deviceScaleFactor:1});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      let now=0,id=0;const pending=new Map();
      Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
      window.requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};
      window.cancelAnimationFrame=id=>pending.delete(id);
      window.advancePromptTest=ms=>{
        do{const step=Math.min(50,ms);now+=step;ms-=step;
          const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(now));
        }while(ms>0);
      };
    });
    const url=process.env.MANA_TEST_URL||pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url);
    const click=selector=>page.locator(selector).click({force:true,noWaitAfter:true});
    const advance=ms=>page.evaluate(ms=>window.advancePromptTest(ms),ms);
    const edit=(id,value)=>page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
    const status=page.locator('#interactionPrompt');
    const state=()=>status.getAttribute('data-prompt-state');
    await page.evaluate(()=>{
      const begin=ManaResults.Session.prototype.begin,step=RevealFlow.prototype.step;
      window.promptObserved={};
      ManaResults.Session.prototype.begin=function(...args){const result=begin.apply(this,args);
        window.promptObserved={session:this,result,json:JSON.stringify(result)};return result;};
      RevealFlow.prototype.step=function(...args){window.promptObserved.flow=this;return step.apply(this,args);};
    });
    const flowState=()=>page.evaluate(()=>window.promptObserved.flow.state);
    const checkResult=()=>page.evaluate(()=>{
      const s=window.promptObserved;
      return s.result===s.session.currentResult&&Object.isFrozen(s.result)&&s.json===JSON.stringify(s.result);
    });
    const restart=async()=>{await advance(16000);await click('#formalReplay');await click('#btnRetryCert');await advance(0);
      assert.equal(await status.isVisible(),false);assert.equal(await page.locator('#waitingPrompt').isVisible(),true);};
    assert.equal(await status.isVisible(),false);
    await edit('waitingPromptPositionY',100);
    await edit('waitingPromptText','請按照你的方法\n觸碰儀器');
    // Public controls select a real fire round; instrumentation observes without forcing outcomes.
    for(const name of ['water','wind','earth','lightning','light','dark','muggle']) await page.locator('#s_'+name).uncheck({force:true});
    await click('#tab_probabilities');
    for(const rank of ['E','D','C','B','A','S','SS']) await edit('chance_'+rank,rank==='E'?100:0);
    await click('#btnStart');await advance(0);
    const guide=await page.locator('#waitingPrompt').boundingBox();
    await page.mouse.move(218,430);await page.mouse.down();await advance(300);
    assert.equal(await state(),'sensed');
    assert.equal(await page.locator('#waitingPrompt').isVisible(),false);
    const box=await status.boundingBox();
    assert.ok(Math.abs(box.y-92)<.1&&Math.abs(box.x+box.width/2-217.5)<.1,'independent upper position and horizontal center');
    assert.equal(await status.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await advance(900);assert.equal(await state(),'holding');
    const labelBox=await status.locator('[data-prompt-current]').boundingBox();
    assert.ok(Math.abs(labelBox.y-92)<.1,'visible copy remains at the fixed upper position');
    await page.screenshot({path:path.join(os.tmpdir(),'mana-prompt-v163-hold.png')});
    await page.mouse.move(290,520,{steps:5});await advance(900);
    assert.equal(await state(),'drawing');
    await page.screenshot({path:path.join(os.tmpdir(),'mana-prompt-v163-drawing.png')});
    await page.mouse.up();await advance(600);
    assert.equal(await flowState(),'WAITING');assert.equal(await state(),'drawing');
    await page.mouse.move(180,450);await page.mouse.down();await page.mouse.move(280,370,{steps:5});
    await advance(200);await page.mouse.up();await advance(1200);
    assert.equal(await flowState(),'WAITING');assert.equal(await state(),'drawing','resumable drawing must not announce completion');
    await advance(550);assert.equal(await flowState(),'GATHER');assert.equal(await state(),'resonance');
    await advance(1100);assert.equal(await state(),'gathering');
    await advance(1200);assert.equal(await status.isVisible(),false,'hidden before attribute reveal');
    assert.ok(await checkResult());
    await restart();
    // Taps show the new star status while their quiet period remains resumable.
    await page.mouse.move(218,430);await page.mouse.down();await advance(200);await page.mouse.up();await advance(1200);
    assert.equal(await flowState(),'WAITING');assert.equal(await state(),'stars');
    await page.mouse.down();await advance(1100);assert.equal(await state(),'holding');
    const beforePause=await status.getAttribute('style');
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await advance(5000);
    assert.equal(await status.getAttribute('style'),beforePause,'paused page does not advance text animation');
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.mouse.up();await advance(1400);
    assert.equal(await flowState(),'DRAWING');assert.equal(await status.isVisible(),false);
    await page.mouse.down();await advance(3050);
    assert.equal(await flowState(),'WAITING');assert.equal(await state(),'resonance','auto hold is committed before pointerup');
    await page.mouse.up();await advance(1100);assert.equal(await state(),'gathering');
    await advance(3500);assert.equal(await status.isVisible(),false);assert.ok(await checkResult());
    await advance(16000);await click('#formalReplay');await click('#btnGoHome');
    assert.equal(await status.isVisible(),false);
    await click('#tab_effects');await click('#effectPreview');
    await page.mouse.move(218,430);await page.mouse.down();await advance(1000);
    assert.equal(await status.isVisible(),false,'effect preview is isolated');await page.mouse.up();
    assert.deepEqual(errors,[]);
    if(url.startsWith('http')){
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{polling:50});
      await context.setOffline(true);
      // Navigation uses a normal clock; the gesture page deliberately replaces RAF/performance.
      const offlinePage=await context.newPage();
      offlinePage.on('pageerror',error=>errors.push(String(error)));
      await offlinePage.goto(url);await offlinePage.reload();
      assert.equal(await offlinePage.evaluate(()=>typeof InteractionPrompt.View),'function','offline cache includes the new module');
      assert.equal(await offlinePage.locator('#appVersion').getAttribute('data-version'),
        await page.locator('#appVersion').getAttribute('data-version'));
      assert.deepEqual(errors,[]);
    }
    console.log('PASS real drawing/hold/resume/cancel/retry/preview, position, pause, immutable result, offline module and zero page errors.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
