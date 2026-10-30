'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/ashy0/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      let now=0,id=0;const frames=new Map();
      Object.defineProperty(performance,'now',{value:()=>now});
      requestAnimationFrame=f=>{frames.set(++id,f);return id;};cancelAnimationFrame=id=>frames.delete(id);
      window.advance=ms=>{do{const dt=Math.min(50,ms);ms-=dt;now+=dt;const batch=[...frames.values()];frames.clear();batch.forEach(f=>f(now));}while(ms>0);};
    });
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(()=>{
      const draw=LightAngelMotionRenderer.prototype.draw;
      LightAngelMotionRenderer.prototype.draw=function(...args){window.angel=this;window.angelArgs=args;return draw.apply(this,args);};
      const reset=RevealFlow.prototype.reset;
      RevealFlow.prototype.reset=function(...args){window.flowUnderTest=this;return reset.apply(this,args);};
      window.hashAngel=()=>{const p=angel.patchCtx.getImageData(0,0,angel.patch.width,angel.patch.height).data;let hash=2166136261;for(let i=0;i<p.length;i+=4)hash=Math.imul(hash^p[i],16777619);return hash>>>0;};
    });
    const click=id=>page.locator('#'+id).click({force:true});
    const advance=ms=>page.evaluate(ms=>window.advance(ms),ms);
    await click('tab_effects');await page.getByText('屬性揭曉樣板',{exact:true}).click();
    await click('materialPreviewOpen');await click('material_light');
    await page.waitForFunction(()=>window.angel?.loaded,null,{polling:100});await advance(650);
    assert.equal(await page.locator('#materialError').isVisible(),false);
    assert.equal(await page.locator('#materialWindRanks').isVisible(),false);
    assert.equal(await page.evaluate(()=>angel.meshes.length),2);
    // Direct material preview retains the exact standalone pixels at the same box/time.
    assert.ok(await page.evaluate(async()=>{
      const r=angel,args=angelArgs,other=new LightAngelMotionRenderer();await other.ready;
      const c=document.createElement('canvas');c.width=390;c.height=844;
      other.draw(c.getContext('2d'),args[1],args[2],args[3]);
      const equal=other.patch.toDataURL()===r.patch.toDataURL();other.dispose();window.angel=r;window.angelArgs=args;return equal;
    }),'shared renderer preserves approved art');
    await click('materialPause');const held=await page.evaluate(()=>({time:angel.frame.time,hash:hashAngel()}));
    await advance(300);assert.deepEqual(await page.evaluate(()=>({time:angel.frame.time,hash:hashAngel()})),held);
    await click('materialReplay');assert.equal(await page.evaluate(()=>angel.frame.time),0);
    await advance(150);await page.evaluate(()=>{window.oldAngel=angel;});await click('effectPreviewBack');
    assert.equal(await page.evaluate(()=>oldAngel.disposed),true);
    await click('flowPreviewOpen');await click('material_light');
    // Real drawing, release and production state machine reach light formation.
    await page.mouse.move(110,300);await page.mouse.down();await page.mouse.move(250,390,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>typeof LightAngelWingAsset==='string');
    await advance(50);
    for(let i=0;i<14;i++)await advance(500);
    assert.equal(await page.evaluate(()=>flowUnderTest.state),'REVEAL');
    assert.equal(await page.evaluate(()=>flowUnderTest.holdAtReveal),true);
    assert.equal(await page.locator('#revealTitle').textContent(),'光屬性');
    assert.equal(await page.locator('#materialError').isVisible(),false);
    // Sample the host's frame through its existing pause/redraw control.
    await click('materialPause');
    for(const [width,height] of [[390,844],[320,568],[844,390],[1440,900]]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>{flowUnderTest.elapsed=5.4;});
      await click('materialPause');await click('materialPause');
      assert.equal(await page.evaluate(()=>angel.gl.getError()),0);
      await page.screenshot({path:path.join(root,`artifacts/light-angel-reveal-${width}x${height}.png`)});
      const bounds=await page.locator('#materialControls').boundingBox();
      assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
    }
    await page.setViewportSize({width:390,height:844});
    const idleHash=await page.evaluate(()=>hashAngel());await click('materialPause');await advance(500);
    assert.notEqual(await page.evaluate(()=>hashAngel()),idleHash,'idle continues after release');
    await page.evaluate(()=>{flowUnderTest.elapsed=12;});await advance(50);
    assert.equal(await page.evaluate(()=>flowUnderTest.state),'REVEAL','does not settle/freeze after first loop');
    const before=await page.evaluate(()=>flowUnderTest.elapsed);
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await advance(400);
    assert.equal(await page.evaluate(()=>flowUnderTest.elapsed),before);
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await advance(100);
    assert.ok(await page.evaluate(()=>flowUnderTest.elapsed)>before);
    await page.evaluate(()=>{window.loss=angel.gl.getExtension('WEBGL_lose_context');loss.loseContext();});
    await page.waitForFunction(()=>angel.lost);const lostTime=await page.evaluate(()=>flowUnderTest.elapsed);await advance(200);
    assert.equal(await page.evaluate(()=>flowUnderTest.elapsed),lostTime);
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!angel.lost&&!!angel.program);await advance(100);
    assert.equal(await page.locator('#materialError').isVisible(),false);
    await click('materialReplay');assert.equal(await page.evaluate(()=>flowUnderTest.state),'DRAWING');
    assert.equal(await page.locator('#revealTitle').isVisible(),false);
    for(const element of ['fire','wind','earth','dark','light']){
      await click('material_'+element);assert.equal(await page.evaluate(()=>flowUnderTest.element),element);
      assert.equal(await page.locator('#revealTitle').evaluate(e=>e.classList.contains('lightAngelTitle')),element==='light');
    }
    await page.evaluate(()=>{window.oldAngel=angel;});await click('effectPreviewBack');assert.equal(await page.evaluate(()=>oldAngel.disposed),true);
    assert.deepEqual(errors,[]);console.log('PASS light reveal: exact shared pixels, file loading, draw-to-reveal, live idle, pause/replay, four layouts, lifecycle, context recovery and element switching.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
