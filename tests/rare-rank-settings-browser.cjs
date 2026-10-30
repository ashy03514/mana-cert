const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(90000);
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{for(let i=0;i<ms;i+=50){now+=50;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(now));}};
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>{
      const begin=ManaResults.Session.prototype.begin;
      ManaResults.Session.prototype.begin=function(...args){window.lastSettings=args[0];window.currentSession=this;const r=begin.apply(this,args);window.savedResult=r;return r;};
      const Original=LightAngelLayeredGrowthRenderer;window.LightAngelLayeredGrowthRenderer=class extends Original{
        constructor(){super();window.lightUnderTest=this;}
        draw(...args){this.hostArgs=args;return window.paintLight?super.draw(...args):!this.error;}
      };
      // Deterministic low ticket reproduces the old fixed A outcome. The
      // production picker itself and actual settings remain unmodified.
      Math.random=()=>.1;
    });
    const click=id=>page.locator('#'+id).click({force:true});
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_light').check({force:true});
    for(const rank of ['SS','S']){
      await click('tab_probabilities');
      await page.locator('#rareChance_'+rank).evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
      assert.equal(await page.locator('#rarePercent_'+rank).textContent(),'100%');
      await click('btnStart');await page.waitForFunction(()=>lightUnderTest.loaded,null,{polling:100});
      const selected=await page.evaluate(()=>({result:savedResult,weights:lastSettings.rareElementRanks}));
      assert.equal(selected.weights[rank],100);assert.equal(selected.result.rank,rank);assert.equal(selected.result.element,'光');
      await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(250,370,{steps:6});await page.mouse.up();
      for(let i=0;i<27;i++)await page.evaluate(()=>advance(500));
      await page.evaluate(()=>{window.paintLight=true;advance(50);});
      assert.equal(await page.locator('#fireScanRank').textContent(),rank);
      assert.equal(Number(await page.locator('#fireScanValue').textContent()),selected.result.mana);
      assert.equal(await page.evaluate(()=>lightUnderTest.growthState.growth),rank==='SS'?2:1);
      assert.ok(await page.evaluate(()=>currentSession.currentResult===savedResult&&Object.isFrozen(savedResult)));
      assert.equal(await page.locator('#materialError').isVisible(),false);
      await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-probability-'+rank+'-100.png')});
      await page.evaluate(()=>window.paintLight=false);await click('formalReplay');
      assert.equal(await page.evaluate(()=>currentSession.currentResult.rank),rank,'retry uses same configured distribution');
      await click('effectPreviewBack');console.log(rank+' 100% real settings -> formal value/rank/wings/retry passed.');
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
