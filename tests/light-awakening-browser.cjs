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
      const reset=RevealFlow.prototype.reset;RevealFlow.prototype.reset=function(...args){window.f=this;return reset.apply(this,args);};
      const begin=ManaResults.Session.prototype.begin;ManaResults.Session.prototype.begin=function(...args){window.session=this;window.outcome=begin.apply(this,args);return outcome;};
      const original=LightAngelLayeredGrowthRenderer;window.LightAngelLayeredGrowthRenderer=class extends original{constructor(){super();window.r=this;}draw(...args){window.materialDraws=(materialDraws||0)+1;return super.draw(...args);}};
      window.materialDraws=0;window.cues=[];const play=AudioManager.prototype.play;AudioManager.prototype.play=function(slot){window.lastAudioManager=this;cues.push(slot);return play.call(this,slot);};
      window.hash=()=>document.querySelector('#animCanvas').toDataURL();
    });
    // Read the real canvas ID instead of assuming a separate test surface.
    const canvasId=await page.locator('canvas').first().getAttribute('id');
    await page.evaluate(id=>window.hash=()=>document.getElementById(id).toDataURL(),canvasId);
    await page.locator('#s_master').uncheck({force:true});await page.locator('#s_light').check({force:true});
    await page.locator('#btnStart').click({force:true});await page.waitForFunction(()=>r.loaded,null,{polling:100});
    await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(240,365,{steps:8});await page.mouse.up();
    for(let i=0;i<90;i++){await page.evaluate(()=>advance(50));if(await page.evaluate(()=>f.state==='AWAKEN'))break;}
    assert.equal(await page.evaluate(()=>f.state),'AWAKEN');assert.equal(await page.evaluate(()=>session.state),'GATHER');
    assert.equal(await page.evaluate(()=>f.materialFrame),null);assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
    assert.equal(await page.evaluate(()=>materialDraws),0,'wings not painted before awakening ends');
    assert.equal(await page.evaluate(()=>cues.filter(x=>x==='lightAwaken').length),1);
    const saved=await page.evaluate(()=>JSON.stringify(outcome));
    // Paused/resize and background tabs cannot restart the ritual or its sound.
    await page.evaluate(()=>{f.paused=true;f.elapsed=.3;advance(0);});const held=await page.evaluate(()=>hash());
    await page.evaluate(()=>advance(250));assert.equal(await page.evaluate(()=>hash()),held);
    await page.evaluate(()=>{f.paused=false;dispatchEvent(new Event('pagehide'));});const elapsed=await page.evaluate(()=>f.elapsed);
    await page.evaluate(()=>advance(500));assert.equal(await page.evaluate(()=>f.elapsed),elapsed);
    await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));f.paused=true;});
    for(const [name,time,state] of [['core',.25,'AWAKEN'],['rays',.85,'AWAKEN'],['opening',1.65,'AWAKEN'],['handoff',.3,'FORM']]){
      await page.evaluate(({time,state})=>{f.state=state;f.elapsed=time;advance(0);},{time,state});
      assert.equal(await page.locator('#fireScanReadout').isVisible(),false);
      await page.screenshot({path:path.resolve(__dirname,'../artifacts/light-awakening-'+name+'.png')});
    }
    await page.evaluate(()=>{f.state='AWAKEN';f.elapsed=1.85;f.paused=false;advance(50);});
    assert.equal(await page.evaluate(()=>f.state),'FORM');assert.equal(await page.evaluate(()=>session.state),'ELEMENT_REVEAL');
    await page.evaluate(()=>advance(1500));assert.equal(await page.evaluate(()=>session.state),'MANA_SCAN');
    assert.equal(await page.evaluate(()=>JSON.stringify(outcome)),saved);assert.equal(await page.evaluate(()=>session.currentResult===outcome&&Object.isFrozen(outcome)),true);
    assert.equal(await page.evaluate(()=>cues.filter(x=>x==='lightAwaken').length),1);
    assert.equal(await page.locator('#materialError').isVisible(),false);
    await page.locator('#effectPreviewBack').click();await page.locator('#tab_effects').click();
    await page.getByText('屬性揭曉樣板',{exact:true}).click();await page.locator('#flowPreviewOpen').click();await page.locator('#material_light').click();
    await page.waitForFunction(()=>r.loaded,null,{polling:100});
    await page.mouse.move(100,280);await page.mouse.down();await page.mouse.move(240,365,{steps:8});await page.mouse.up();
    for(let i=0;i<90;i++){await page.evaluate(()=>advance(50));if(await page.evaluate(()=>f.state==='AWAKEN'))break;}
    assert.equal(await page.evaluate(()=>f.state),'AWAKEN');
    await page.locator('#materialPause').click();assert.equal(await page.evaluate(()=>lastAudioManager.voices.size),0,'preview pause stops the awakening chord');
    const paused=await page.evaluate(()=>f.elapsed);await page.evaluate(()=>advance(300));assert.equal(await page.evaluate(()=>f.elapsed),paused);
    await page.locator('#materialReplay').click();assert.equal(await page.evaluate(()=>f.state),'DRAWING');assert.equal(await page.evaluate(()=>lastAudioManager.voices.size),0);
    await page.locator('#material_water').click();assert.equal(await page.evaluate(()=>f.awakeningEnabled),false);
    assert.deepEqual(errors,[]);
    console.log('PASS light awakening formal: real drawing→ritual→wings→scan, no early material/readout, immutable outcome, one cue, pause/background and handoff.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
